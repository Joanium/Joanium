export const SEARCH_TOOLS = [
  {
    name: 'search_web',
    description:
      'Search the web for any topic and get instant answers, related topics, and result summaries using DuckDuckGo. Great for quick lookups, current events, definitions, and general knowledge.',
    category: 'search',
    parameters: {
      query: {
        type: 'string',
        required: true,
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
        required: true,
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
        required: true,
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
        required: true,
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
        required: true,
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
        required: true,
        description:
          'The research topic or paper title to search for (e.g. "attention is all you need", "quantum computing error correction")',
      },
      max_results: {
        type: 'number',
        required: false,
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
        required: true,
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
        required: true,
        description:
          'Movie or TV show title to search for (e.g. "Inception", "Breaking Bad", "The Dark Knight")',
      },
      type: {
        type: 'string',
        required: false,
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
        required: true,
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
        required: true,
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
        required: true,
        description:
          'The full URL to look up in the Wayback Machine (e.g. "https://example.com", "https://old-website.com/page")',
      },
      timestamp: {
        type: 'string',
        required: false,
        description:
          'Optional target timestamp in YYYYMMDDHHmmss format to find the nearest snapshot (e.g. "20200101000000" for Jan 1 2020). Defaults to the most recent snapshot.',
      },
    },
  },
];
