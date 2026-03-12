import { Link } from 'react-router-dom';

export function SettingsPage () {
    return (
        <div className="page-container">
            <h1>オプション設定</h1>

            <section className="card">
                <h2>基本設定</h2>

                <div className="form-grid">
                    <label>
                        最大項目数
                        <input className="input-control" type="number" min="2" max="9" defaultValue="2" />
                    </label>

                    <label>
                        1項目目 最大桁数
                        <input className="input-control" type="number" min="1" max="9" defaultValue="2" />
                    </label>

                    <label>
                        2項目目 最大桁数
                        <input className="input-control" type="number" min="1" max="9" defaultValue="2" />
                    </label>

                    <label>
                        出題数
                        <input className="input-control" type="number" min="1" max="100" defaultValue="10" />
                    </label>
                </div>
            </section>

            <section className="card">
                <h2>時間設定</h2>

                <label className="single-check">
                    <input type="checkbox" />
                    時間制限あり
                </label>

                <label>
                    時間制限（秒）
                    <input className="input-control" type="number" min="1" max="300" defaultValue="10" />
                </label>
            </section>

            <section className="card">
                <h2>追加オプション</h2>

                <div className="check-group">
                    <label><input type="checkbox" /> マイナス計算を許可</label>
                    <label><input type="checkbox" /> 小数を許可</label>
                    <label><input type="checkbox" /> 割り算の余りを許可</label>
                    <label><input type="checkbox" /> 実数の割り算を許可</label>
                    <label><input type="checkbox" /> 手書きメモ欄を有効化</label>
                </div>
            </section>

            <section className="card">
                <h2>プリセット</h2>

                <div className="button-row">
                    <button type="button">小4</button>
                    <button type="button">中1</button>
                    <button type="button">高校基礎</button>
                </div>
            </section>

            <section className="card">
                <div className="button-row">
                    <Link className="button-like" to="/">TOPへ戻る</Link>
                    <Link className="button-like" to="/quiz">この設定で開始</Link>
                </div>
            </section>
        </div>
    );
}