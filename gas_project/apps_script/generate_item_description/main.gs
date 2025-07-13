// 有効なGeminiAPIキー
const GEMINI_API_KEY = "XXXXXXXXXX";
// スプレッドシートのID
const GOOGLE_SPREAD_SHEET_ID = "YYYYYYYYYY";
// GoogleDriveの画像を入れたフォルダのID
const GOOGLE_DRIVE_FOLDER_ID = "ZZZZZZZZZZ";

/**
 * メイン処理
 */
function main() {
  try {
    // Googleドライブからフォルダーの画像を取得
    const { itemImages, folderName } = getGoogleDriveImages(
      GOOGLE_DRIVE_FOLDER_ID
    );

    // GeminiAPIにリクエストして商品説明を生成
    const generatedText = callGeminiApi(
      GEMINI_API_KEY,
      getPrompt(),
      itemImages
    );

    // スプレッドシートに書き込む
    writeToSheet(generatedText, folderName, GOOGLE_SPREAD_SHEET_ID);

    Browser.msgBox("商品説明の生成が完了しました。");
  } catch (e) {
    Logger.log(e.stack);
    Browser.msgBox("【エラー】: " + e.message);
  }
}

/**
 * スプレッドシートを開いたときにカスタムメニューを追加する
 */
function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu("フリマ出品アシスタント")
    .addItem("最新の画像から商品説明を生成", "main")
    .addToUi();
}
