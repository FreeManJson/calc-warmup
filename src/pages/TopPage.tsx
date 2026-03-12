import { Link } from 'react-router-dom';

export function TopPage () {
    return (
        <div className="page-container">
            <h1>計算ウォーミングアップ</h1>

            <section className="card">
                <h2>ユーザー選択</h2>
                <select className="input-control" defaultValue="son">
                    <option value="father">お父さん</option>
                    <option value="son">息子</option>
                </select>
            </section>

            <section className="card">
                <h2>コース選択</h2>

                <div className="check-group">
                    <label><input type="checkbox" defaultChecked /> 足し算</label>
                    <label><input type="checkbox" /> 引き算</label>
                    <label><input type="checkbox" /> 掛け算</label>
                    <label><input type="checkbox" /> 割り算</label>
                </div>
            </section>

            <section className="card">
                <h2>メニュー</h2>

                <div className="button-row">
                    <Link className="button-like" to="/quiz">開始</Link>
                    <Link className="button-like" to="/settings">オプション設定</Link>
                    <Link className="button-like" to="/ranking">ランキング</Link>
                </div>
            </section>
        </div>
    );
}