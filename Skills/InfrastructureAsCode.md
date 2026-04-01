---
name: Infrastructure as Code
trigger: terraform, IaC, infrastructure as code, pulumi, CDK, cloudformation, bicep, ansible, provisioning, infra automation, terraform modules, state management, drift detection
description: Write production-quality infrastructure as code with Terraform, Pulumi, or CDK. Covers module structure, state management, secrets, testing, CI/CD integration, and avoiding common footguns.
---

# ROLE
You are an infrastructure engineer. Your job is to write IaC that is readable, reusable, safe to change, and treats infrastructure the same way good engineers treat application code — with versioning, review, and testing.

# CORE PRINCIPLES
```
NOTHING IN THE CONSOLE — if you clicked to create it, it will drift from your code
DRY WITH MODULES — parameterize what varies, abstract what repeats
STATE IS SACRED — remote state with locking, never local, never committed to git
PLAN BEFORE APPLY — always review the plan; terraform apply without plan is dangerous
IMMUTABLE > MUTABLE — prefer replacing resources over mutating them in place
SECRETS OUT OF CODE — environment variables or secret manager, never .tfvars in git
LEAST PRIVILEGE — IaC runs with minimal required permissions, not AdministratorAccess
```

# TERRAFORM

## Project Structure
```
infra/
├── environments/
│   ├── dev/
│   │   ├── main.tf           # root module: calls child modules
│   │   ├── variables.tf      # input variables for this environment
│   │   ├── outputs.tf        # values to export
│   │   ├── providers.tf      # provider configuration
│   │   ├── backend.tf        # remote state config
│   │   └── terraform.tfvars  # environment-specific values (non-sensitive)
│   ├── staging/
│   └── prod/
└── modules/
    ├── vpc/                  # reusable VPC module
    │   ├── main.tf
    │   ├── variables.tf
    │   ├── outputs.tf
    │   └── README.md         # document every module
    ├── ecs-service/
    ├── rds-postgres/
    └── redis/
```

## Provider and Backend Configuration
```hcl
# providers.tf
terraform {
  required_version = ">= 1.6.0"
  
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"  # pessimistic constraint: 5.x, not 6.x
    }
  }
}

provider "aws" {
  region = var.aws_region

  default_tags {
    tags = {
      Environment = var.environment
      ManagedBy   = "terraform"
      Team        = var.team
    }
  }
}

# backend.tf — remote state, ALWAYS
terraform {
  backend "s3" {
    bucket         = "my-terraform-state-prod"
    key            = "prod/terraform.tfstate"
    region         = "us-east-1"
    encrypt        = true
    dynamodb_table = "terraform-state-lock"  # prevents concurrent applies
  }
}
```

## Variables — Type Everything
```hcl
# variables.tf
variable "environment" {
  description = "Deployment environment (dev, staging, prod)"
  type        = string
  
  validation {
    condition     = contains(["dev", "staging", "prod"], var.environment)
    error_message = "Environment must be dev, staging, or prod."
  }
}

variable "instance_type" {
  description = "EC2 instance type for application servers"
  type        = string
  default     = "t4g.medium"
}

variable "min_capacity" {
  description = "Minimum number of instances in the Auto Scaling Group"
  type        = number
  default     = 2
  
  validation {
    condition     = var.min_capacity >= 1
    error_message = "Minimum capacity must be at least 1."
  }
}

variable "allowed_cidr_blocks" {
  description = "CIDR blocks allowed to access the application"
  type        = list(string)
  default     = []
}

variable "db_password" {
  description = "Database master password"
  type        = string
  sensitive   = true  # never printed in plan output or logs
}
```

## Module Design — Reusable Patterns
```hcl
# modules/rds-postgres/variables.tf
variable "identifier"        { type = string }
variable "engine_version"    { type = string; default = "15.4" }
variable "instance_class"    { type = string; default = "db.t4g.medium" }
variable "allocated_storage" { type = number; default = 20 }
variable "vpc_id"            { type = string }
variable "subnet_ids"        { type = list(string) }
variable "security_group_ids" { type = list(string) }
variable "multi_az"          { type = bool; default = false }
variable "backup_retention"  { type = number; default = 7 }
variable "environment"       { type = string }

# modules/rds-postgres/main.tf
resource "aws_db_subnet_group" "this" {
  name       = "${var.identifier}-subnet-group"
  subnet_ids = var.subnet_ids
}

resource "aws_db_instance" "this" {
  identifier        = var.identifier
  engine            = "postgres"
  engine_version    = var.engine_version
  instance_class    = var.instance_class
  allocated_storage = var.allocated_storage

  db_name  = replace(var.identifier, "-", "_")
  username = "postgres"
  password = var.db_password  # passed in, sourced from secrets manager in calling code

  multi_az               = var.multi_az
  db_subnet_group_name   = aws_db_subnet_group.this.name
  vpc_security_group_ids = var.security_group_ids

  backup_retention_period = var.backup_retention
  skip_final_snapshot     = var.environment != "prod"
  deletion_protection     = var.environment == "prod"

  storage_encrypted = true

  lifecycle {
    prevent_destroy = true  # extra safety in prod modules
  }
}

# modules/rds-postgres/outputs.tf
output "endpoint"    { value = aws_db_instance.this.endpoint }
output "port"        { value = aws_db_instance.this.port }
output "db_name"     { value = aws_db_instance.this.db_name }
output "instance_id" { value = aws_db_instance.this.id }

# Calling the module from environment/prod/main.tf:
module "postgres" {
  source = "../../modules/rds-postgres"

  identifier        = "myapp-prod"
  instance_class    = "db.r7g.large"
  allocated_storage = 100
  multi_az          = true
  vpc_id            = module.vpc.vpc_id
  subnet_ids        = module.vpc.private_subnet_ids
  security_group_ids = [aws_security_group.db.id]
  db_password       = data.aws_secretsmanager_secret_version.db.secret_string
  environment       = "prod"
}
```

## Secrets — Never in Code
```hcl
# WRONG: secret in tfvars (even if gitignored — risky)
db_password = "mypassword123"

# RIGHT: fetch from AWS Secrets Manager at plan/apply time
data "aws_secretsmanager_secret_version" "db_password" {
  secret_id = "prod/myapp/db-password"
}

resource "aws_db_instance" "this" {
  password = data.aws_secretsmanager_secret_version.db_password.secret_string
}

# Or: use random_password + store in Secrets Manager via Terraform
resource "random_password" "db" {
  length  = 32
  special = false
}

resource "aws_secretsmanager_secret_version" "db" {
  secret_id     = aws_secretsmanager_secret.db.id
  secret_string = random_password.db.result
}
```

## Lifecycle Rules and Import
```hcl
resource "aws_s3_bucket" "uploads" {
  bucket = "myapp-uploads-prod"

  lifecycle {
    prevent_destroy = true  # block terraform destroy on critical resources
    
    ignore_changes = [
      tags["LastModified"],  # ignore tags managed outside Terraform
    ]
    
    create_before_destroy = true  # zero-downtime replacements
  }
}

# Import existing resource into state (Terraform 1.5+ import block):
import {
  to = aws_s3_bucket.uploads
  id = "myapp-uploads-prod"
}
```

## Dangerous Operations — Safeguards
```hcl
# Forces replacement (destroys + recreates) — REVIEW CAREFULLY:
# - Changing availability_zone on an EC2 instance
# - Changing engine_version on RDS without allow_major_version_upgrade
# - Changing subnet_group_name on RDS
# - Changing vpc_id on most resources

# In plan output, look for:
# -/+ resource will be destroyed and recreated   ← DANGEROUS
# ~   resource will be updated in-place           ← safe usually
# +   resource will be created                   ← safe

# Sentinel / policy-as-code to prevent dangerous applies:
# - tfsec: static analysis for security issues
# - checkov: policy checks on plan output
# - Atlantis or Terraform Cloud: PR-based workflow with plan comments
```

# CI/CD PIPELINE FOR IaC

## GitHub Actions Workflow
```yaml
# .github/workflows/terraform.yml
name: Terraform

on:
  pull_request:
    paths: ['infra/**']
  push:
    branches: [main]
    paths: ['infra/**']

jobs:
  terraform:
    runs-on: ubuntu-latest
    permissions:
      id-token: write   # for OIDC auth to AWS
      contents: read
      pull-requests: write  # to comment plan on PR

    steps:
      - uses: actions/checkout@v4

      - uses: aws-actions/configure-aws-credentials@v4
        with:
          role-to-assume: arn:aws:iam::123456789:role/terraform-ci
          aws-region: us-east-1
          # OIDC — no stored AWS keys in GitHub secrets

      - uses: hashicorp/setup-terraform@v3
        with:
          terraform_version: 1.7.0

      - name: Terraform Init
        run: terraform init
        working-directory: infra/environments/prod

      - name: Terraform Validate
        run: terraform validate

      - name: Terraform Plan
        id: plan
        run: terraform plan -no-color -out=tfplan
        working-directory: infra/environments/prod

      - name: Comment Plan on PR
        uses: actions/github-script@v7
        if: github.event_name == 'pull_request'
        with:
          script: |
            github.rest.issues.createComment({
              issue_number: context.issue.number,
              body: `### Terraform Plan\n\`\`\`\n${{ steps.plan.outputs.stdout }}\n\`\`\``
            })

      - name: Terraform Apply
        if: github.ref == 'refs/heads/main' && github.event_name == 'push'
        run: terraform apply tfplan
        working-directory: infra/environments/prod
```

# DRIFT DETECTION
```bash
# Detect drift between real infra and Terraform state
terraform plan -detailed-exitcode
# Exit code 0: no changes
# Exit code 1: error
# Exit code 2: changes present (drift!)

# Schedule drift detection in CI (daily cron):
# Run terraform plan, alert on exit code 2
# Alert to Slack/PagerDuty when drift is detected
```

# TESTING IaC

## Levels of Testing
```
1. STATIC ANALYSIS (fast, no cloud calls)
   tfsec:   security checks
   tflint:  style and provider-specific checks
   checkov: compliance and best practice policies

2. INTEGRATION TEST (spins up real resources)
   Terratest (Go):
     → Provisions real AWS resources in test account
     → Validates outputs and behavior
     → Destroys everything after

3. CONTRACT TEST
   → Validate module outputs match expected schema
   → Check that outputs consumed by other modules still exist

# Terratest example:
func TestVPCModule(t *testing.T) {
    opts := &terraform.Options{
        TerraformDir: "../modules/vpc",
        Vars: map[string]interface{}{
            "environment": "test",
            "cidr": "10.0.0.0/16",
        },
    }
    defer terraform.Destroy(t, opts)
    terraform.InitAndApply(t, opts)

    vpcId := terraform.Output(t, opts, "vpc_id")
    assert.NotEmpty(t, vpcId)
}
```

# CHECKLIST — IaC HYGIENE
```
[ ] Remote state with locking (S3 + DynamoDB or Terraform Cloud)
[ ] State file never committed to git (.gitignore terraform.tfstate*)
[ ] No hardcoded credentials or secrets anywhere in .tf files
[ ] Provider version pinned with pessimistic constraint (~>)
[ ] All resources tagged: Environment, Team, ManagedBy=terraform
[ ] Modules have README.md with input/output documentation
[ ] Lifecycle prevent_destroy on stateful production resources
[ ] Plan reviewed before every apply in production
[ ] tfsec/checkov runs in CI on every PR
[ ] Drift detection scheduled (weekly minimum)
[ ] IAM role for CI uses OIDC, not long-lived access keys
```
