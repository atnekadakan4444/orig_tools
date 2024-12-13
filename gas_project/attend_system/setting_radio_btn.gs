/*********************************************************
 * 参考資料：https://qiita.com/kobaboy/items/610263087d9c85d8458e
 ・出席者の名前をシートから取得しラジオボタンの選択肢として設定する
 *********************************************************/
// enum.gs にて定義
// const SPREAD_SHEET_URI = '163nq_w6AMQ57-LOT-w00Q5iWmFk1-rZeYi0RbnXgwGY'; // スプレッドシート識別子
// const TARGET_COLUMN_NAME = '参加者名'; // 対象カラム

/*=================================================================
・スプレッドシートを変数として格納後に処理を開始
=================================================================*/
function setNameToRadioBtn() {
  // URLより対象のスプレッドシートのシートをすべて取得
  let targetSpreadSheet = SpreadsheetApp.openById(SPREAD_SHEET_URI).getSheets();
  // シートの1つめを対象とする
  targetSheet = targetSpreadSheet[0];

  // セルB1が’参加者名'であれば処理対象とする
  if(targetSheet.getRange("B1").getValue() == TARGET_COLUMN_NAME){
    let name_choices_vals = targetSheet.getRange(1, 2, targetSheet.getLastRow()).getValues();
    // 選択肢生成処理
    process_name_ary(name_choices_vals);
  }
}


/*=================================================================
・ラジオボタンの設問を対象に選択肢を生成
=================================================================*/
function process_name_ary(name_choices_vals) {
  // 多重配列を解消して一次元配列とする
  let flat_names_ary = name_choices_vals.flat();
  // null、空文字など不正な値を除去
  let attemds_names_ary = flat_names_ary.filter((name) => !(name == TARGET_COLUMN_NAME || name == null || name == '' || name == undefined));
  // Setで重複を除去、新たに配列を生成
  let name_choices_ary = Array.from(new Set(attemds_names_ary));

  // ラジオボタンの問題だけを取得
  const items = TARGET_FORM.getItems(FormApp.ItemType.MULTIPLE_CHOICE);

  // 複数ある場合を考慮して配列から取得する
  items.forEach(item => {
    if (item.getTitle() === TARGET_COLUMN_NAME) {
      // 文字列の配列をそのまま選択肢として設定
      target_question = item.asMultipleChoiceItem();
      target_question.setChoiceValues(name_choices_ary);
      // 回答の必須化
      target_question.setRequired(true);
      // 回答に"その他"を追加
      target_question.showOtherOption(true);
    }
  });
}
