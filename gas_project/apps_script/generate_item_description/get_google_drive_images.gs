/**
 * GoogleDriveから出品商品の画像取得
 */
function getGoogleDriveImages(folderId) {
  const folder = DriveApp.getFolderById(folderId);
  const folderName = folder.getName();
  const files = folder.getFiles();

  const itemImages = [];
  while (files.hasNext()) {
    itemImages.push(files.next());
  }

  if (!itemImages) {
    throw new Error("対象フォルダに画像が見つかりませんでした。");
  }

  return { itemImages, folderName };
}
