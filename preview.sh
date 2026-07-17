#!/bin/sh
# Serves the site locally so you can review it in a browser.
# Usage: ./preview.sh
set -e

export PATH="/opt/homebrew/opt/ruby/bin:/opt/homebrew/lib/ruby/gems/4.0.0/bin:$PATH"

cd "$(dirname "$0")"

if [ ! -d vendor/bundle ]; then
  bundle config set --local path 'vendor/bundle'
  bundle install
fi

echo "Serving at http://127.0.0.1:4444 (Ctrl+C to stop)"
bundle exec jekyll serve --port 4444
