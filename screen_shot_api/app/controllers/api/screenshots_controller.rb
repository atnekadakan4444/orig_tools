module Api
  class ScreenshotsController < ApplicationController
    MAX_SCROLL_HEIGHT = 8000
    SCROLL_STEP = 200
    SCROLL_INTERVAL = 0.15 # 150ms
    POST_SCROLL_WAIT = 2
    JPEG_QUALITY = 70

    def create
      url = params[:url]

      if url.blank?
        return render json: { error: "url is required" }, status: :bad_request
      end

      unless url.match?(%r{\Ahttps?://}i)
        return render json: { error: "url must start with http:// or https://" }, status: :bad_request
      end

      screenshot_data = capture_screenshot(url)
      send_data screenshot_data, type: "image/jpeg", disposition: "inline"
    rescue Ferrum::TimeoutError
      render json: { error: "Page load timed out" }, status: :gateway_timeout
    rescue Ferrum::StatusError => e
      render json: { error: "Failed to load page: #{e.message}" }, status: :bad_gateway
    rescue StandardError => e
      render json: { error: "Screenshot failed: #{e.message}" }, status: :internal_server_error
    end

    private

    def capture_screenshot(url)
      browser_opts = {
        headless: true,
        process_timeout: 20,
        timeout: 30,
        window_size: [1280, 720],
        browser_options: {
          "no-sandbox" => nil,
          "disable-gpu" => nil,
          "disable-dev-shm-usage" => nil
        }
      }
      browser_opts[:browser_path] = ENV["CHROME_PATH"] if ENV["CHROME_PATH"]

      browser = Ferrum::Browser.new(**browser_opts)

      begin
        browser.go_to(url)

        # デバイスピクセル比を1.0に固定
        browser.execute("window.devicePixelRatio = 1.0")

        # 遅延読み込み対応: 自動スクロール
        scroll_for_lazy_load(browser)

        # スクロール完了後、描画完了のため2秒待機
        sleep POST_SCROLL_WAIT

        # ページ全体のスクリーンショットを取得（バイナリデータとして返却）
        browser.screenshot(
          full: true,
          format: "jpeg",
          quality: JPEG_QUALITY,
          encoding: :binary
        )
      ensure
        browser.quit
      end
    end

    def scroll_for_lazy_load(browser)
      current_position = 0

      loop do
        current_position += SCROLL_STEP

        break if current_position > MAX_SCROLL_HEIGHT

        browser.execute("window.scrollTo(0, #{current_position})")
        sleep SCROLL_INTERVAL

        # ページの実際の高さを超えたら終了
        page_height = browser.evaluate("document.body.scrollHeight")
        break if current_position >= page_height
      end

      # ページ最上部に戻す（フルスクリーンショットのため）
      browser.execute("window.scrollTo(0, 0)")
      sleep 0.1
    end
  end
end
