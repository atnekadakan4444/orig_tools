/******************************************************************
 * 参考資料： https://zenn.dev/sdb_blog/articles/002-render-okosu
 ******************************************************************/

// 【変更必須】ここにデプロイしたWebアプリのURLを指定する
const APP_URL_ARY = [
    'https://XXXXX.com',
  ];

/*=================================================================
・Renderへのリクエスト(安定版)
=================================================================*/
// function request_to_render() {
//   // レスポンスコードを取得するだけ
//   APP_URL_ARY.forEach((APP_URL) => {
//     const HTTP_STATUS = UrlFetchApp.fetch(APP_URL).getResponseCode();
//     console.log(`${ APP_URL } : ${ HTTP_STATUS }`); // デバッグ用
//   });
  
// }

/*=================================================================
・Renderへのリクエスト(タイムアウト版)
=================================================================*/
function request_to_render() {
  // レスポンスコードを取得するだけ
  APP_URL_ARY.forEach((url) => {
    result = request_process(url);
    console.log(`${ url } : ${ result }`);
  });
}

function request_process(url, maxRetries = 3) {
  // fetch options
  var options = {
    'muteHttpExceptions': true,
    'timeout': 15000
  };

  // リクエスト処理
  for (let i = 0; i < maxRetries; i++) {
    try {
      // 15sのタイムアウト設定し、成功した場合はレスポンスコードを返す
      const response = UrlFetchApp.fetch(url, options).getResponseCode();
      return response;
    } catch (e) {
        console.log('リクエストエラー: ' + e.message);
      if (i < maxRetries) {
        console.log(`${ i + 1 }回目の再試行`);
      } else {
        console.log('最大試行回数に達しました。');
      }
    }
  }
  // 失敗した場合はfalseを返す
  return false;
}
