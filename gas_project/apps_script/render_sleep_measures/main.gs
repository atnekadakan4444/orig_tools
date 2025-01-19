/******************************************************************
 * 参考資料： https://data-x.jp/blog/gassetmintrigger/#index_id4 
 ******************************************************************/

// セットおよび削除するトリガー名
const TRIGGER_FUNC_NAME = 'requestRenderTrigger'

/*=================================================================
・トリガーを定期的に設定および削除するプロセス
=================================================================*/
// 既存の同名のトリガーを削除
function setMinTrigger() {
  let triggers = ScriptApp.getScriptTriggers();
  for(let trigger of triggers){
    let funcName = trigger.getHandlerFunction();
    if(funcName == TRIGGER_FUNC_NAME){
      ScriptApp.deleteTrigger(trigger);
    }
  }
  // 年月日と現在時刻の取得
  let now = new Date();
  let y = now.getFullYear();
  let m = now.getMonth();
  let d = now.getDate();
  let hh = now.getHours();
  let mm = now.getMinutes();
  // 現在時刻から10分後に実行されるトリガーを生成
  let date = new Date(y, m, d, hh, mm + 10);
  ScriptApp.newTrigger(TRIGGER_FUNC_NAME).timeBased().at(date).create();
}


/*=================================================================
・「対象のURLにリクエストを送る」処理のトリガーのセットおよび既存のトリガー削除
=================================================================*/
function requestRenderTrigger() {
  request_to_render(); // request_to_render.gs > function request_to_render()
  setMinTrigger(); //上記内容が処理し終える度にトリガーをセットする
}
