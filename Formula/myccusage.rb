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
  url "https://github.com/shokk/homebrew-myccusage/archive/refs/tags/v1.0.2.tar.gz"
  version "1.0.2"
  sha256 "efce8a7815cebe02f3e97791edaddab2622c4f587bf8bea26c322149baac00a1"
  license "MIT"
  head "https://github.com/shokk/homebrew-myccusage.git", branch: "master"

  depends_on "ccusage"
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
      Start the dashboard with:

        myccusage

      It listens on http://127.0.0.1:4318 by default (override with --port).
      Pass --host 0.0.0.0 to make it reachable from other devices on your network.
    EOS
  end

  test do
    assert_match version.to_s, shell_output("#{bin}/myccusage --version")
    assert_match "Usage: myccusage", shell_output("#{bin}/myccusage --help")
  end
end
