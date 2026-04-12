export const SEARCH_TOOLS = [
  {
    name: 'search_web',
    description:
      'Search the web for any topic and get instant answers, related topics, and result summaries using DuckDuckGo. Great for quick lookups, current events, definitions, and general knowledge.',
    category: 'search',
    parameters: {
      query: {
        type: 'string',
        required: !0,
        description:
          'The search query (e.g. "latest SpaceX launch", "how to center a div in CSS", "who is the CEO of Apple")',
      },
    },
  },
  {
    name: 'search_npm',
    description:
      'Search the npm registry for JavaScript/Node.js packages. Returns package name, version, description, author, weekly downloads, and homepage link.',
    category: 'search',
    parameters: {
      query: {
        type: 'string',
        required: !0,
        description:
          'The npm package name or keyword to search for (e.g. "react router", "lodash", "express middleware")',
      },
    },
  },
  {
    name: 'search_pypi',
    description:
      'Search the Python Package Index (PyPI) for Python libraries and tools. Returns package name, version, summary, author, and PyPI page link.',
    category: 'search',
    parameters: {
      query: {
        type: 'string',
        required: !0,
        description:
          'The Python package name or keyword to search for (e.g. "numpy", "web scraping", "fastapi")',
      },
    },
  },
  {
    name: 'search_crates',
    description:
      'Search crates.io for Rust crates (packages). Returns crate name, version, description, downloads, and documentation link.',
    category: 'search',
    parameters: {
      query: {
        type: 'string',
        required: !0,
        description:
          'The Rust crate name or keyword to search for (e.g. "tokio", "serde", "http client")',
      },
    },
  },
  {
    name: 'search_docker',
    description:
      'Search Docker Hub for public container images. Returns image name, description, pull count, star count, and whether it is an official image.',
    category: 'search',
    parameters: {
      query: {
        type: 'string',
        required: !0,
        description:
          'The Docker image name or keyword to search for (e.g. "nginx", "postgres", "node alpine")',
      },
    },
  },
  {
    name: 'search_arxiv',
    description:
      'Search arXiv for academic preprint papers in physics, mathematics, computer science, AI/ML, and related fields. Returns title, authors, abstract summary, and PDF link.',
    category: 'search',
    parameters: {
      query: {
        type: 'string',
        required: !0,
        description:
          'The research topic or paper title to search for (e.g. "attention is all you need", "quantum computing error correction")',
      },
      max_results: {
        type: 'number',
        required: !1,
        description: 'Maximum number of results to return (default: 5, max: 10)',
      },
    },
  },
  {
    name: 'search_books',
    description:
      'Search Open Library (by the Internet Archive) for books. Returns title, author, first published year, edition count, and Open Library page link.',
    category: 'search',
    parameters: {
      query: {
        type: 'string',
        required: !0,
        description:
          'Book title, author name, or subject to search for (e.g. "Harry Potter", "Stephen King", "machine learning")',
      },
    },
  },
  {
    name: 'search_movies',
    description:
      'Search for movies and TV shows using the OMDB API. Returns title, year, type (movie/series), IMDb rating, genre, plot summary, director, and poster URL.',
    category: 'search',
    parameters: {
      query: {
        type: 'string',
        required: !0,
        description:
          'Movie or TV show title to search for (e.g. "Inception", "Breaking Bad", "The Dark Knight")',
      },
      type: {
        type: 'string',
        required: !1,
        description: 'Filter by type: "movie", "series", or "episode" (default: any)',
      },
    },
  },
  {
    name: 'search_producthunt',
    description:
      'Search Product Hunt for the latest tech products, apps, and tools launched by the community. Returns product name, tagline, upvote count, and Product Hunt link.',
    category: 'search',
    parameters: {
      query: {
        type: 'string',
        required: !0,
        description:
          'Product name or category to search for (e.g. "AI writing tool", "productivity app", "open source devtool")',
      },
    },
  },
  {
    name: 'search_cve',
    description:
      'Search for CVE (Common Vulnerabilities and Exposures) security advisories. Returns CVE ID, description, CVSS severity score, affected software, and publication date.',
    category: 'search',
    parameters: {
      query: {
        type: 'string',
        required: !0,
        description:
          'CVE ID or software/vulnerability keyword to search for (e.g. "CVE-2021-44228", "log4j", "nginx remote code execution")',
      },
    },
  },
  {
    name: 'search_wayback',
    description:
      'Check the Wayback Machine (Internet Archive) for archived snapshots of any URL. Returns the closest available archived version with its timestamp.',
    category: 'search',
    parameters: {
      url: {
        type: 'string',
        required: !0,
        description:
          'The full URL to look up in the Wayback Machine (e.g. "https://example.com", "https://old-website.com/page")',
      },
      timestamp: {
        type: 'string',
        required: !1,
        description:
          'Optional target timestamp in YYYYMMDDHHmmss format to find the nearest snapshot (e.g. "20200101000000" for Jan 1 2020). Defaults to the most recent snapshot.',
      },
    },
  },
  {
    name: 'search_maven',
    description:
      'Search Maven Central for Java, Kotlin, Scala, and JVM library artifacts. Returns groupId, artifactId, latest version, and Maven coordinates for use in pom.xml or build.gradle.',
    category: 'search',
    parameters: {
      query: {
        type: 'string',
        required: !0,
        description:
          'Package name, groupId, or keyword (e.g. "jackson databind", "org.springframework", "okhttp")',
      },
      max_results: {
        type: 'number',
        required: !1,
        description: 'Number of results to return (default: 5, max: 10)',
      },
    },
  },
  {
    name: 'search_nuget',
    description:
      'Search the NuGet package registry for .NET, C#, F#, and VB.NET libraries. Returns package ID, latest version, description, authors, total downloads, and NuGet page link.',
    category: 'search',
    parameters: {
      query: {
        type: 'string',
        required: !0,
        description:
          'Package name or keyword to search for (e.g. "Newtonsoft.Json", "Entity Framework", "Serilog")',
      },
    },
  },
  {
    name: 'search_packagist',
    description:
      'Search Packagist for PHP Composer packages. Returns package name, description, latest version, total downloads, GitHub stars, and require string for composer.json.',
    category: 'search',
    parameters: {
      query: {
        type: 'string',
        required: !0,
        description:
          'Package name or keyword to search for (e.g. "laravel/framework", "guzzlehttp", "symfony console")',
      },
    },
  },
  {
    name: 'search_rubygems',
    description:
      'Search RubyGems.org for Ruby gems (libraries). Returns gem name, version, description, author, total downloads, and gem page link.',
    category: 'search',
    parameters: {
      query: {
        type: 'string',
        required: !0,
        description:
          'Gem name or keyword to search for (e.g. "rails", "devise", "rspec", "sinatra")',
      },
    },
  },
  {
    name: 'search_pub',
    description:
      'Search pub.dev for Dart and Flutter packages. Returns package name, version, description, publisher, pub points, popularity score, and pub.dev link.',
    category: 'search',
    parameters: {
      query: {
        type: 'string',
        required: !0,
        description:
          'Package name or keyword to search for (e.g. "http", "provider", "riverpod", "flutter bloc")',
      },
    },
  },
  {
    name: 'search_hex',
    description:
      'Search Hex.pm for Elixir and Erlang packages. Returns package name, latest version, description, downloads, repository link, and hex.pm page.',
    category: 'search',
    parameters: {
      query: {
        type: 'string',
        required: !0,
        description:
          'Package name or keyword to search for (e.g. "phoenix", "ecto", "plug", "jason")',
      },
    },
  },
  {
    name: 'search_hackage',
    description:
      'Search Hackage for Haskell packages. Returns package name, version, synopsis, author, and Hackage page link.',
    category: 'search',
    parameters: {
      query: {
        type: 'string',
        required: !0,
        description:
          'Package name or keyword to search for (e.g. "aeson", "lens", "conduit", "servant")',
      },
    },
  },
  {
    name: 'search_cpan',
    description:
      'Search CPAN (via MetaCPAN) for Perl modules and distributions. Returns module name, abstract, author, version, and MetaCPAN link.',
    category: 'search',
    parameters: {
      query: {
        type: 'string',
        required: !0,
        description:
          'Module name or keyword to search for (e.g. "Moose", "LWP::UserAgent", "DBI", "DateTime")',
      },
    },
  },
  {
    name: 'search_conda',
    description:
      'Search the Anaconda / conda-forge ecosystem for Python data science, ML, and scientific computing packages. Returns package name, latest version, description, and Anaconda page link.',
    category: 'search',
    parameters: {
      query: {
        type: 'string',
        required: !0,
        description:
          'Package name or keyword to search for (e.g. "scikit-learn", "pytorch", "pandas", "opencv")',
      },
    },
  },
  {
    name: 'search_swift',
    description:
      'Search the Swift Package Index for Swift packages compatible with the Swift Package Manager. Returns package name, description, author, Swift version compatibility, and SPI link.',
    category: 'search',
    parameters: {
      query: {
        type: 'string',
        required: !0,
        description:
          'Package name or keyword to search for (e.g. "Alamofire", "Combine", "SwiftUI charts", "Vapor")',
      },
    },
  },
  {
    name: 'search_julia',
    description:
      'Search JuliaHub for Julia language packages. Returns package name, description, stars, and JuliaHub link.',
    category: 'search',
    parameters: {
      query: {
        type: 'string',
        required: !0,
        description:
          'Package name or keyword to search for (e.g. "Flux.jl", "DataFrames", "DifferentialEquations", "Plots")',
      },
    },
  },
  {
    name: 'search_gradle',
    description:
      'Search the Gradle Plugin Portal for Gradle build plugins. Returns plugin ID, description, latest version, implementation string, and Gradle portal link.',
    category: 'search',
    parameters: {
      query: {
        type: 'string',
        required: !0,
        description:
          'Plugin name or keyword to search for (e.g. "android", "shadow jar", "kotlin", "spotless")',
      },
    },
  },
  {
    name: 'search_cocoapods',
    description:
      'Search CocoaPods for iOS, macOS, watchOS, and tvOS libraries compatible with the CocoaPods dependency manager. Returns pod name, version, description, and CocoaPods page link.',
    category: 'search',
    parameters: {
      query: {
        type: 'string',
        required: !0,
        description:
          'Pod name or keyword to search for (e.g. "Alamofire", "SDWebImage", "Firebase", "RxSwift")',
      },
    },
  },
  {
    name: 'search_homebrew',
    description:
      'Search Homebrew formulae and casks for macOS and Linux developer tools, CLIs, and applications. Returns formula name, description, version, and Homebrew page link.',
    category: 'search',
    parameters: {
      query: {
        type: 'string',
        required: !0,
        description:
          'Formula or cask name to look up (e.g. "ffmpeg", "git", "node", "postgresql"). Works best with exact or near-exact names.',
      },
    },
  },
  {
    name: 'search_vscode',
    description:
      'Search the Visual Studio Code Marketplace for editor extensions. Returns extension name, publisher, description, install count, rating, and Marketplace link.',
    category: 'search',
    parameters: {
      query: {
        type: 'string',
        required: !0,
        description:
          'Extension name or keyword to search for (e.g. "Prettier", "ESLint", "GitHub Copilot", "Python")',
      },
    },
  },
  {
    name: 'search_terraform',
    description:
      'Search the Terraform Registry for providers and modules. Returns provider/module name, namespace, description, download count, and registry link.',
    category: 'search',
    parameters: {
      query: {
        type: 'string',
        required: !0,
        description:
          'Provider or module name to search for (e.g. "aws", "kubernetes", "google cloud storage", "vpc")',
      },
      type: {
        type: 'string',
        required: !1,
        description: 'Filter by type: "providers" or "modules" (default: providers)',
      },
    },
  },
  {
    name: 'search_ansible',
    description:
      'Search Ansible Galaxy for roles and collections. Returns name, namespace, description, author, download count, and Galaxy link.',
    category: 'search',
    parameters: {
      query: {
        type: 'string',
        required: !0,
        description:
          'Role or collection name to search for (e.g. "nginx", "docker", "kubernetes", "postgresql")',
      },
    },
  },
  {
    name: 'search_wordpress_plugins',
    description:
      'Search the WordPress Plugin Directory for plugins. Returns plugin name, author, description, active installs, rating, tested WordPress version, and plugin page link.',
    category: 'search',
    parameters: {
      query: {
        type: 'string',
        required: !0,
        description:
          'Plugin name or keyword to search for (e.g. "WooCommerce", "Yoast SEO", "contact form", "caching")',
      },
    },
  },
  {
    name: 'search_godot',
    description:
      'Search the Godot Asset Library for game assets, plugins, scripts, and tools compatible with the Godot game engine. Returns asset name, author, description, category, and asset library link.',
    category: 'search',
    parameters: {
      query: {
        type: 'string',
        required: !0,
        description:
          'Asset name or keyword to search for (e.g. "dialogue system", "procedural terrain", "inventory", "shader")',
      },
    },
  },
  {
    name: 'search_cran',
    description:
      'Search CRAN (Comprehensive R Archive Network) for R packages. Returns package name, version, description, author, license, and CRAN page link. Tries exact name match via crandb, then suggests the CRAN search URL.',
    category: 'search',
    parameters: {
      query: {
        type: 'string',
        required: !0,
        description: 'R package name or keyword (e.g. "ggplot2", "dplyr", "caret", "time series")',
      },
    },
  },
  {
    name: 'search_clojars',
    description:
      'Search Clojars for Clojure and ClojureScript libraries. Returns group ID, artifact ID, latest version, description, and Clojars page link.',
    category: 'search',
    parameters: {
      query: {
        type: 'string',
        required: !0,
        description:
          'Library name or keyword (e.g. "ring", "compojure", "reagent", "clojure.core")',
      },
    },
  },
  {
    name: 'search_opam',
    description:
      'Search OPAM (OCaml Package Manager) for OCaml libraries. Tries a direct package lookup via the OPAM registry, then falls back to a DuckDuckGo-scoped search.',
    category: 'search',
    parameters: {
      query: {
        type: 'string',
        required: !0,
        description: 'Package name or keyword (e.g. "lwt", "cohttp", "ppx_deriving", "core")',
      },
    },
  },
  {
    name: 'search_elm',
    description:
      'Search the official Elm package repository (package.elm-lang.org) for Elm libraries. Returns package name, summary, license, and latest version.',
    category: 'search',
    parameters: {
      query: {
        type: 'string',
        required: !0,
        description: 'Package name or keyword (e.g. "elm/html", "elm-ui", "Http", "decoder")',
      },
    },
  },
  {
    name: 'search_dub',
    description:
      'Search the DUB package registry (code.dlang.org) for D programming language libraries. Returns package name, version, description, author, and DUB page link.',
    category: 'search',
    parameters: {
      query: {
        type: 'string',
        required: !0,
        description:
          'Package name or keyword (e.g. "vibe-d", "mir-algorithm", "hunt-framework", "crypto")',
      },
    },
  },
  {
    name: 'search_nimble',
    description:
      'Search the official Nim package registry (nim-lang/packages on GitHub) for Nimble packages. Returns package name, description, URL, and install command.',
    category: 'search',
    parameters: {
      query: {
        type: 'string',
        required: !0,
        description: 'Package name or keyword (e.g. "prologue", "karax", "jsony", "sqlite")',
      },
    },
  },
  {
    name: 'search_luarocks',
    description:
      'Search LuaRocks for Lua modules and libraries. Returns module name, author, description, and LuaRocks page link.',
    category: 'search',
    parameters: {
      query: {
        type: 'string',
        required: !0,
        description: 'Module name or keyword (e.g. "lpeg", "luasocket", "penlight", "moonscript")',
      },
    },
  },
  {
    name: 'search_crystal',
    description:
      'Search shards.info for Crystal language shards (packages). Returns shard name, description, GitHub stars, latest version, and shard page link.',
    category: 'search',
    parameters: {
      query: {
        type: 'string',
        required: !0,
        description: 'Shard name or keyword (e.g. "amber", "kemal", "lucky", "http")',
      },
    },
  },
  {
    name: 'search_purescript',
    description:
      'Search Pursuit, the official PureScript package documentation hub, for PureScript packages and modules. Returns package name, version, description, author, and Pursuit link.',
    category: 'search',
    parameters: {
      query: {
        type: 'string',
        required: !0,
        description:
          'Package or module name (e.g. "purescript-halogen", "Effect", "Aff", "purescript-foreign")',
      },
    },
  },
  {
    name: 'search_nix',
    description:
      'Search the NixOS package repository (nixpkgs) for Nix packages. Returns attribute name, package name, version, description, and link to search.nixos.org.',
    category: 'search',
    parameters: {
      query: {
        type: 'string',
        required: !0,
        description:
          'Package attribute name or keyword (e.g. "nodejs", "rustc", "ffmpeg", "python3Packages.numpy")',
      },
    },
  },
  {
    name: 'search_go',
    description:
      'Search pkg.go.dev for Go modules and packages. Returns module path, description, stars, and pkg.go.dev link.',
    category: 'search',
    parameters: {
      query: {
        type: 'string',
        required: !0,
        description:
          'Module path, package name, or keyword (e.g. "gin", "cobra", "golang.org/x/net", "grpc")',
      },
    },
  },
  {
    name: 'search_conan',
    description:
      'Search ConanCenter (conan.io) for C and C++ Conan packages. Returns package name, latest version, description, and ConanCenter link.',
    category: 'search',
    parameters: {
      query: {
        type: 'string',
        required: !0,
        description: 'Package name or keyword (e.g. "boost", "openssl", "zlib", "nlohmann_json")',
      },
    },
  },
  {
    name: 'search_vcpkg',
    description:
      'Search the official Microsoft vcpkg C/C++ package registry (microsoft/vcpkg on GitHub) for ports. Returns port name, version, description, dependencies, and vcpkg install command.',
    category: 'search',
    parameters: {
      query: {
        type: 'string',
        required: !0,
        description: 'Port name or keyword (e.g. "boost", "sqlite3", "zlib", "opencv")',
      },
    },
  },
  {
    name: 'search_haxelib',
    description:
      'Search Haxelib (lib.haxe.org) for Haxe libraries. Tries an exact name lookup, then falls back to a keyword search via DuckDuckGo.',
    category: 'search',
    parameters: {
      query: {
        type: 'string',
        required: !0,
        description: 'Library name or keyword (e.g. "haxeui", "openfl", "lime", "actuate")',
      },
    },
  },
  {
    name: 'search_racket',
    description:
      'Search the Racket package catalog (pkgs.racket-lang.org) for Racket packages. Returns package name, description, author, tags, and catalog link.',
    category: 'search',
    parameters: {
      query: {
        type: 'string',
        required: !0,
        description:
          'Package name or keyword (e.g. "web-server", "data-science", "json", "rackunit")',
      },
    },
  },
  {
    name: 'search_spack',
    description:
      'Search the Spack HPC package manager registry for scientific computing and high-performance computing packages. Returns package name, description, homepage, and Spack install command.',
    category: 'search',
    parameters: {
      query: {
        type: 'string',
        required: !0,
        description: 'Package name or keyword (e.g. "hdf5", "openmpi", "fftw", "pytorch")',
      },
    },
  },
  {
    name: 'search_meson_wrap',
    description:
      'Search the Meson WrapDB for wrap packages — pre-configured Meson build definitions for popular C/C++ libraries. Returns package name, available versions, and WrapDB install command.',
    category: 'search',
    parameters: {
      query: {
        type: 'string',
        required: !0,
        description: 'Wrap package name or keyword (e.g. "zlib", "openssl", "glib", "libpng")',
      },
    },
  },
  {
    name: 'search_scoop',
    description:
      'Search the Scoop package manager (Windows) for apps and CLI tools from its official main bucket. Returns app name, description, version, and install command.',
    category: 'search',
    parameters: {
      query: {
        type: 'string',
        required: !0,
        description: 'App name or keyword (e.g. "git", "nodejs", "python", "ffmpeg")',
      },
    },
  },
  {
    name: 'search_winget',
    description:
      'Search the Windows Package Manager (winget) catalog for Windows apps and developer tools. Returns package ID, name, publisher, description, and winget install command.',
    category: 'search',
    parameters: {
      query: {
        type: 'string',
        required: !0,
        description: 'App name or keyword (e.g. "Git.Git", "Microsoft.VSCode", "Python", "7zip")',
      },
    },
  },
  {
    name: 'search_ctan',
    description:
      'Search CTAN (Comprehensive TeX Archive Network) for LaTeX and TeX packages, styles, fonts, and tools. Returns package name, caption, description, documentation link, and CTAN page.',
    category: 'search',
    parameters: {
      query: {
        type: 'string',
        required: !0,
        description:
          'Package name or keyword (e.g. "tikz", "beamer", "amsmath", "babel", "geometry")',
      },
    },
  },
];
