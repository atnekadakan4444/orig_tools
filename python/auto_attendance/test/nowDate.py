# 日時関連の命令に使用する時に宣言
from datetime import datetime
from tkinter import messagebox

# 現在時刻を取得
t = datetime.now()
fmt = t.strftime('%m/%d');
print(fmt) # 現在時刻を文字列で表示

messagebox.showinfo('nowDate.pyの実行結果', fmt);