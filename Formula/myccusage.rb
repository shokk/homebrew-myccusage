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
  url "https://github.com/shokk/homebrew-myccusage/archive/refs/tags/v1.1.1.tar.gz"
  version "1.1.1"
  sha256 "ff37dd667d06780a91dab42c2b75a66eb3426e64f3d2d54ae4788ff172aaf1d3"
  license "MIT"
  head "https://github.com/shokk/homebrew-myccusage.git", branch: "master"

  depends_on "ccusage"
  depends_on "node"

  def install
    libexec.install "server.js", "public", "package.json"
    (bin/"myccusage").write <<~EOS
      #!/bin/bash
      # Resolved to an absolute path so this keeps working under brew
      # services (launchd/systemd), where PATH is minimal and doesn't
      # include Homebrew's own bin directory.
      export CCUSAGE_BIN="#{Formula["ccusage"].opt_bin}/ccusage"
      exec "#{Formula["node"].opt_bin}/node" "#{libexec}/server.js" "$@"
    EOS
  end

  def caveats
    <<~EOS
      Start the dashboard in the foreground with:

        myccusage

      Or run it as a background service (survives closing your terminal,
      restarts if it crashes, optionally starts on login):

        brew services start myccusage   # start now + on every login
        brew services run myccusage     # start now only, no login registration
        brew services stop myccusage    # stop it
        brew services info myccusage    # check status

      Either way it listens on http://127.0.0.1:4318 by default. In the
      foreground, override with `myccusage --port <n> --host <addr>`. As a
      service, `brew services` doesn't take extra flags — set PORT/HOST via an
      env file instead:

        mkdir -p ~/.homebrew/services
        echo 'HOST=0.0.0.0' >> ~/.homebrew/services/myccusage.env
        brew services restart myccusage

      Service logs: #{var}/log/myccusage.log
    EOS
  end

  service do
    run [opt_bin/"myccusage"]
    keep_alive true
    log_path var/"log/myccusage.log"
    error_log_path var/"log/myccusage.log"
  end

  test do
    assert_match version.to_s, shell_output("#{bin}/myccusage --version")
    assert_match "Usage: myccusage", shell_output("#{bin}/myccusage --help")
  end
end
