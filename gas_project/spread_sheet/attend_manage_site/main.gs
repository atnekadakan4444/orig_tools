/*****************
 * 参考資料
 * https://uncle-gas.com/gas-html-order-form/
 *****************/

/***************** 画面遷移プロセス *****************/
/*====================================================*
* 概要 : Webページ表示時に実行される関数
* index.html
* negative_incentive.html
*====================================================*/
const attend_sheet = '出席リスト';
const negative_incentive_sheet = 'ネガティブインセンティブ';
const negativeIncentive = 'negative_incentive';

function doGet(e) {
  // パラメータで遷移先を分岐。ここではアウトプット記録表へ飛ばせる
  let page = e.parameter.page;
  if(page === negativeIncentive){
    const items = getAllRecords(attend_sheet);
    const template = HtmlService.createTemplateFromFile(negativeIncentive);
    template.deployURL = ScriptApp.getService().getUrl();
    template.formHTML = getFormHTML(e, items);
    const htmlOutput = template.evaluate();
    return htmlOutput;
  }

  const items = getAllRecords(attend_sheet);
  const template = HtmlService.createTemplateFromFile('index');
  template.deployURL = ScriptApp.getService().getUrl();
  template.formHTML = getFormHTML(e, items);
  const htmlOutput = template.evaluate();
  return htmlOutput;
}

function getAppUrl() {
  return ScriptApp.getService().getUrl();
}

/*====================================================*
* 概要 : フォーム送信に伴っての画面遷移制御
* confirm.html
* complete.html
*====================================================*/
function doPost(e) {
  const items = getAllRecords(attend_sheet);
  const records = getAllRecords(negative_incentive_sheet);

  /********************** 出席リスト関連 **********************/
  // index.htmlで「確認画面へ」ボタンが押されたらconfirm.htmlへ
  if(e.parameter.confirm) {
    const template = HtmlService.createTemplateFromFile('confirm');
    template.deployURL = ScriptApp.getService().getUrl();
    template.confirmHTML = getConfirmHTML(e, items);
    const htmlOutput = template.evaluate();
    return htmlOutput;
  }

  // confirm.htmlで「修正する」ボタンが押されたらindex.htmlへ
  if(e.parameter.modify) {
    const template = HtmlService.createTemplateFromFile('index');
    template.deployURL = ScriptApp.getService().getUrl();
    template.formHTML = getFormHTML(e, items);
    const htmlOutput = template.evaluate();
    return htmlOutput;
  }

  // confirm.htmlで「申請する」ボタンが押されたらcomplete.htmlへ
  if(e.parameter.submit) {
    createRecord(e, items); // レコード作成
    const template = HtmlService.createTemplateFromFile('complete');
    template.deployURL = ScriptApp.getService().getUrl();
    const htmlOutput = template.evaluate();
    return htmlOutput;
  }

  /********************** ネガティブインセンティブ記録関連 **********************/
  // index.htmlで「確認画面へ」ボタンが押されたらconfirm.htmlへ
  if(e.parameter.record_confirm) {
    const template = HtmlService.createTemplateFromFile('record_confirm');
    template.deployURL = ScriptApp.getService().getUrl();
    template.outputConfirmHTML = getOutputConfirmHTML(e);
    const htmlOutput = template.evaluate();
    return htmlOutput;
  }

  // confirm.htmlで「修正する」ボタンが押されたらindex.htmlへ
  if(e.parameter.record_modify) {
    const template = HtmlService.createTemplateFromFile(negativeIncentive);
    template.deployURL = ScriptApp.getService().getUrl();
    template.formHTML = getFormHTML(e, records);
    const htmlOutput = template.evaluate();
    return htmlOutput;
  }

  // confirm.htmlで「申請する」ボタンが押されたらcomplete.htmlへ
  if(e.parameter.record_submit) {
    createRecord(e, records); // レコード作成
    const template = HtmlService.createTemplateFromFile('record_complete');
    template.deployURL = ScriptApp.getService().getUrl();
    const htmlOutput = template.evaluate();
    return htmlOutput;
  }
}

/**************************************************************************************************************************/
/***************** 動的表示関連プロセス *****************/
/*====================================================*
* 概要 : index.htmlの表示内容を動的に表示するため値を格納
*        メインロジック
*====================================================*/
// 値の取得
function getAllRecords(sheetName) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(sheetName);
  const values = sheet.getDataRange().getValues();
  const labels = values.shift();

  const records = [];
  for(const value of values) {
    const record = {};
    labels.forEach((label, index) => {
      record[label] = value[index];      
    });
    records.push(record);
  }

  return records;
}

/*====================================================*
* 概要 : index.htmlを動的に表示するためシートから値を取得
*====================================================*/
function getFormHTML(e, items) {
  // 条件分岐用
  //本日の日付を取得
  const today = new Date();
  //翌日の値を取得
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);

  // 修正用の初期値に対する処理 (初期表示時はエラー回避のため空文字とする)
  const schedule = e.parameter.schedule ? e.parameter.schedule : formatDate(today);
  const userName = e.parameter.userName ? e.parameter.userName : '';
  const userInfo = e.parameter.userInfo ? e.parameter.userInfo : '';


  let html = `
    <div class="mb-3" style="max-width: 200px;">
      <label for="email" class="form-label fw-bold">出席予定日</label>
      <input type="date" class="form-control" id="schedule" name="schedule" required value="${ schedule }"></input>
    </div>

    <div class="mb-3" style="max-width: 400px;">
      <label for="userName" class="form-label fw-bold">参加者名　<span style="color: red;">(※LT会参加時に使用する Discord のユーザー名)</span></label>
      <input type="text" class="form-control" id="userName" name="userName" required value="${ userName }">
    </div>

    <div class="mb-3" style="max-width: 400px;">
      <label for="userInfo" class="form-label fw-bold">報告事項など</label>
      <input type="text" class="form-control" id="userInfo" name="userInfo" value="${ userInfo }">
    </div>

    <button type="submit" class="btn btn-primary" name="confirm" value="true">申請内容の確認画面へ</button>

    <h2 class="text-center pt-4">本日の出席者一覧</h2>
    <table class="table table-striped">
      <thead>
        <tr>
          <th scope="col" class="text-center">(人)</th>
          <th scope="col" class="text-end">ID</th>
          <th scope="col" class="text-center">出席予定日</th>
          <th scope="col" class="text-center">参加ユーザー名</th>
          <th scope="col" class="text-center">報告事項など</th>
        </tr>
      </thead>
      <tbody>
  `;

  for(const item of items) {
    // 本日の参加者を表示   
    const dataId = item['ID'];
    const attend_schedule = item['出席予定日'];
    const attend_username = item['名前'];
    const attend_user_Info = item['報告事項など'];

    // 今日出席予定のレコードだけ表示
    if(attend_schedule.toLocaleDateString() === today.toLocaleDateString()){
      html += `<tr>`;
      html += `<td class="text-center"></td>`;
      html += `<td class="text-end">${dataId}</td>`;
      html += `<td class="text-center">${attend_schedule.toLocaleDateString()}</td>`;
      html += `<td class="text-center">${attend_username}</td>`;
      html += `<td class="text-start">${attend_user_Info}</td>`;
      html += `</tr>`;
    }
  }
  html += `</tbody>`;
  html += `</table>`;

  // 翌日の参加者を表示
  html += `
    <h2 class="text-center pt-4">明日の出席予定者一覧</h2>
    <table class="table table-striped">
      <thead>
        <tr>
          <th scope="col" class="text-center">(人)</th>
          <th scope="col" class="text-end">ID</th>
          <th scope="col" class="text-center">出席予定日</th>
          <th scope="col" class="text-center">参加ユーザー名</th>
          <th scope="col" class="text-center">報告事項など</th>
        </tr>
      </thead>
      <tbody>
  `;
  
  for(const item of items) {
    // 表示内容
    const dataId = item['ID'];
    const attend_schedule = item['出席予定日'];
    const attend_username = item['名前'];
    const attend_user_Info = item['報告事項など'];

    // 明日出席予定のレコードだけ表示
    if(attend_schedule.toLocaleDateString() === tomorrow.toLocaleDateString()){
      html += `<tr>`;
      html += `<td class="text-center"></td>`;
      html += `<td class="text-end">${dataId}</td>`;
      html += `<td class="text-center">${attend_schedule.toLocaleDateString()}</td>`;
      html += `<td class="text-center">${attend_username}</td>`;
      html += `<td class="text-start">${attend_user_Info}</td>`;
      html += `</tr>`;
    }
  }
  html += `</tbody>`;
  html += `</table>`;

  return html;
}

// `YYYY-MM-dd`の形式に変換する
function formatDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0'); // 月は0から始まるので+1
  const day = String(date.getDate()).padStart(2, '0');
  
  return `${year}-${month}-${day}`;
}


/*====================================================*
* 概要 : index.htmlの送信内容をもとに遷移先であるconfirm.htmlを動的に表示するためシート名から値を取得
*====================================================*/
function getOutputConfirmHTML(e) {
  let html = `
    <div class="mb-3">
      <label for="email" class="form-label fw-bold">出席予定日</label>
      <input type="date" class="form-control" id="schedule" name="schedule" required value="${ e.parameter.schedule }" readonly></input>
    </div>

    <div class="mb-3">
      <label for="userName" class="form-label fw-bold">参加者名　<span style="color: red;">(※LT会参加時に使用する Discord のユーザー名)</span></label>
      <input type="text" class="form-control" id="userName" name="userName" required value="${ e.parameter.userName }" readonly>
    </div>

    <div class="mb-3">
      <label for="userInfo" class="form-label fw-bold">報告事項など</label>
      <input type="text" class="form-control" id="userInfo" name="userInfo" required value="${ e.parameter.userInfo }" readonly>
    </div>

    <p class="mb-3 fw-bold">以上の内容で出席申請してよろしいですか？</p>
    `;

  return html;
}

/*====================================================*
* 概要 : 入力内容からレコードを作成
*====================================================*/
function createRecord(e) {
  // 注文テーブルに単一レコードを追加する
  const attendId = genIndex('出席リスト');
  const submitDate = new Date();
  const attendRecord = [attendId, submitDate, e.parameter.schedule, e.parameter.userName, e.parameter.userInfo];
  addRecord('出席リスト', [attendRecord]);
}

// レコード記録に当たってのシート情報の取得
function genIndex(sheetName) {
  //スクリプトに紐付いたスプレッドシートのアクティブなシートを読み込む
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  //読み込んだシートの最終行を取得する
  const sheet = ss.getSheetByName(sheetName);
  //読み込んだシートの最終行を取得する
  let lastRow = sheet.getLastRow();
  //スプレッドシートで最終行を表示する
  return lastRow;
}

// レコードを末尾に追加
function addRecord(sheetName, records) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(sheetName);
  const lastRow = sheet.getLastRow();
  sheet.getRange(lastRow+1, 1, records.length, records[0].length).setValues(records);
}

/**************************************************************************************************************************/
/***************** 記録表の動的表示関連プロセス *****************/
/*====================================================*
* 概要 : index.htmlの表示内容を動的に表示するため値を格納
*        メインロジック
*====================================================*/
// 値の取得
function getAllRecords(sheetName) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(sheetName);
  const values = sheet.getDataRange().getValues();
  const labels = values.shift();

  const records = [];
  for(const value of values) {
    const record = {};
    labels.forEach((label, index) => {
      record[label] = value[index];      
    });
    records.push(record);
  }

  return records;
}

/*====================================================*
* 概要 : index.htmlを動的に表示するためシートから値を取得
*====================================================*/
function getRecordFormHTML(e, items) {
  // 条件分岐用
  //本日の日付を取得
  const today = new Date();
  //翌日の値を取得
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);

  // 修正用の初期値に対する処理 (初期表示時はエラー回避のため空文字とする)
  const schedule = e.parameter.schedule ? e.parameter.schedule : formatDate(today);
  const userName = e.parameter.userName ? e.parameter.userName : '';
  const userInfo = e.parameter.userInfo ? e.parameter.userInfo : '';


  let html = `
    <div class="mb-3" style="max-width: 200px;">
      <label for="email" class="form-label fw-bold">出席予定日</label>
      <input type="date" class="form-control" id="schedule" name="schedule" required value="${ schedule }"></input>
    </div>

    <div class="mb-3" style="max-width: 400px;">
      <label for="userName" class="form-label fw-bold">参加者名　<span style="color: red;">(※LT会参加時に使用する Discord のユーザー名)</span></label>
      <input type="text" class="form-control" id="userName" name="userName" required value="${ userName }">
    </div>

    <div class="mb-3" style="max-width: 400px;">
      <label for="userInfo" class="form-label fw-bold">報告事項など</label>
      <input type="text" class="form-control" id="userInfo" name="userInfo" value="${ userInfo }">
    </div>

    <button type="submit" class="btn btn-primary" name="confirm" value="true">申請内容の確認画面へ</button>

    <h2 class="text-center pt-4">本日の出席者一覧</h2>
    <table class="table table-striped">
      <thead>
        <tr>
          <th scope="col" class="text-center">(人)</th>
          <th scope="col" class="text-end">ID</th>
          <th scope="col" class="text-center">出席予定日</th>
          <th scope="col" class="text-center">参加ユーザー名</th>
          <th scope="col" class="text-center">報告事項など</th>
        </tr>
      </thead>
      <tbody>
  `;

  for(const item of items) {
    // 本日の参加者を表示   
    const dataId = item['ID'];
    const attend_schedule = item['出席予定日'];
    const attend_username = item['名前'];
    const attend_user_Info = item['報告事項など'];

    // 今日出席予定のレコードだけ表示
    if(attend_schedule.toLocaleDateString() === today.toLocaleDateString()){
      html += `<tr>`;
      html += `<td class="text-center"></td>`;
      html += `<td class="text-end">${dataId}</td>`;
      html += `<td class="text-center">${attend_schedule.toLocaleDateString()}</td>`;
      html += `<td class="text-center">${attend_username}</td>`;
      html += `<td class="text-start">${attend_user_Info}</td>`;
      html += `</tr>`;
    }
  }
  html += `</tbody>`;
  html += `</table>`;

  // 翌日の参加者を表示
  html += `
    <h2 class="text-center pt-4">明日の出席予定者一覧</h2>
    <table class="table table-striped">
      <thead>
        <tr>
          <th scope="col" class="text-center">(人)</th>
          <th scope="col" class="text-end">ID</th>
          <th scope="col" class="text-center">出席予定日</th>
          <th scope="col" class="text-center">参加ユーザー名</th>
          <th scope="col" class="text-center">報告事項など</th>
        </tr>
      </thead>
      <tbody>
  `;
  
  for(const item of items) {
    // 表示内容
    const dataId = item['ID'];
    const attend_schedule = item['出席予定日'];
    const attend_username = item['名前'];
    const attend_user_Info = item['報告事項など'];

    // 明日出席予定のレコードだけ表示
    if(attend_schedule.toLocaleDateString() === tomorrow.toLocaleDateString()){
      html += `<tr>`;
      html += `<td class="text-center"></td>`;
      html += `<td class="text-end">${dataId}</td>`;
      html += `<td class="text-center">${attend_schedule.toLocaleDateString()}</td>`;
      html += `<td class="text-center">${attend_username}</td>`;
      html += `<td class="text-start">${attend_user_Info}</td>`;
      html += `</tr>`;
    }
  }
  html += `</tbody>`;
  html += `</table>`;

  return html;
}

// `YYYY-MM-dd`の形式に変換する
function formatDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0'); // 月は0から始まるので+1
  const day = String(date.getDate()).padStart(2, '0');
  
  return `${year}-${month}-${day}`;
}

/**************************************************************************************************************************/
/*====================================================*
* 概要 : index.htmlの送信内容をもとに遷移先であるconfirm.htmlを動的に表示するためシート名から値を取得
*====================================================*/
function getRecordConfirmHTML(e, items) {
  let html = `
    <div class="mb-3">
      <label for="email" class="form-label fw-bold">出席予定日</label>
      <input type="date" class="form-control" id="schedule" name="schedule" required value="${ e.parameter.schedule }" readonly></input>
    </div>

    <div class="mb-3">
      <label for="userName" class="form-label fw-bold">参加者名　<span style="color: red;">(※LT会参加時に使用する Discord のユーザー名)</span></label>
      <input type="text" class="form-control" id="userName" name="userName" required value="${ e.parameter.userName }" readonly>
    </div>

    <div class="mb-3">
      <label for="userInfo" class="form-label fw-bold">報告事項など</label>
      <input type="text" class="form-control" id="userInfo" name="userInfo" required value="${ e.parameter.userInfo }" readonly>
    </div>

    <p class="mb-3 fw-bold">以上の内容で出席申請してよろしいですか？</p>
    `;

  return html;
}

/*====================================================*
* 概要 : 入力内容からレコードを作成
*====================================================*/
function createOutputRecord(e, records) {
  // 注文テーブルに単一レコードを追加する
  const attendId = genIndex(negativeIncentive);
  const submitDate = new Date();
  const attendRecord = [attendId, submitDate, e.parameter.schedule, e.parameter.userName, e.parameter.outputTitle, e.parameter.outputResources];
  addRecord(negativeIncentive, [attendRecord]);
}

// レコード記録に当たってのシート情報の取得
function genRecordIndex(sheetName) {
  //スクリプトに紐付いたスプレッドシートのアクティブなシートを読み込む
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  //読み込んだシートの最終行を取得する
  const sheet = ss.getSheetByName(sheetName);
  //読み込んだシートの最終行を取得する
  let lastRow = sheet.getLastRow();
  //スプレッドシートで最終行を表示する
  return lastRow;
}

// レコードを末尾に追加
function addRecord(sheetName, records) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(sheetName);
  const lastRow = sheet.getLastRow();
  sheet.getRange(lastRow+1, 1, records.length, records[0].length).setValues(records);
}
