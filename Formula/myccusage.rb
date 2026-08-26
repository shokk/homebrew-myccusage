# Formula/myccusage.rb — part of github.com/shokk/homebrew-myccusage
#
# Users install with:
#   brew tap shokk/myccusage
#   brew install myccusage
#
# To test locally after tapping:
#   brew install --build-from-source shokk/myccusage/myccusage
#   brew test shokk/myccusage/myccusage
#   brew audit --strict --online shokk/myccusage/myccusage

class Myccusage < Formula
  desc "Local web dashboard for ccusage: daily/weekly/monthly AI agent usage"
  homepage "https://github.com/shokk/homebrew-myccusage"
  url "https://github.com/shokk/homebrew-myccusage/archive/refs/tags/v1.0.0.tar.gz"
  version "1.0.0"
  sha256 "0000000000000000000000000000000000000000000000000000000000000"
  license "MIT"
  head "https://github.com/shokk/homebrew-myccusage.git", branch: "main"

  depends_on "node"

  def install
    libexec.install "server.js", "public", "package.json"
    (bin/"myccusage").write <<~EOS
      #!/bin/bash
      exec "#{Formula["node"].opt_bin}/node" "#{libexec}/server.js" "$@"
    EOS
  end

  def caveats
    <<~EOS
      myccusage reads usage data via the `ccusage` CLI, which is not installed by
      this formula. Install it separately if you haven't already:

        npm install -g ccusage

      Then start the dashboard with:

        myccusage

      It listens on http://127.0.0.1:4317 by default (override with --port).
    EOS
  end

  test do
    assert_match version.to_s, shell_output("#{bin}/myccusage --version")
    assert_match "Usage: myccusage", shell_output("#{bin}/myccusage --help")
  end
end
