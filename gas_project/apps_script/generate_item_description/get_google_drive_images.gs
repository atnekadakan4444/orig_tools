/**
 * GoogleDriveから出品商品の画像取得
 */
function getGoogleDriveImages(folderId) {
  const folder = DriveApp.getFolderById(folderId);
  const folderName = folder.getName();
  const files = folder.getFiles();

  const itemImages = [];
  while (files.hasNext()) {
    const file = files.next();
    // ファイルが画像形式かチェック
    if (file.getMimeType().startsWith("image/")) {
      itemImages.push(file);
    }
  }

  if (itemImages.length === 0) {
    throw new Error("対象フォルダに画像が見つかりませんでした。");
  }

  return { itemImages, folderName };
}
