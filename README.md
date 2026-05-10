# jp-cam

日本全国 1,747 市区町村のシルエットをカメラ映像にオーバーレイ表示する Web アプリ。

## 動かし方

```sh
pnpm install
pnpm dev          # http://localhost:3000
pnpm test         # vitest
pnpm build:cities # 市区町村データを再生成 (niiyz/JapanCityGeoJson 経由)
```

## アーキテクチャ

- **トップページ (`app/page.tsx`)** — 47都道府県のピッカー
- **カメラページ (`app/[code]/page.tsx`)** — 選択した都道府県の市区町村を切り替えながら撮影
- **`components/jp-cam/`** — Elm-style に分割されたカメラコンポーネント
  - `state.ts` / `message.ts` / `update.ts` — 純粋な reducer
  - `presenter.ts` / `compose.ts` — 純粋な derivation / utility
  - `view.tsx` — React 側 (refs, dispatch, DOM I/O)
- **`lib/cities-data.ts`** — `/data/cities/{prefCode}.json` を fetch する非同期ローダ
- **`scripts/build-cities.mjs`** — niiyz/JapanCityGeoJson を取得して各市区町村を 0-200 SVG viewBox に投影、Douglas-Peucker 簡略化 (tolerance 0.5) して `public/data/` に書き出す
- **`public/data/prefectures.json`** — 47都道府県の index
- **`public/data/cities/{01..47}.json`** — 都道府県別の市区町村カタログ (合計 ~12 MB, git 管理)

## 仕様メモ

- 市区町村コードは 5 桁 JIS コード (01100 札幌市 〜 47382 与那国町)
- 政令指定都市 20 市は行政区を親市にマージして 1 エントリで表示 (例: 横浜市)
- 東京 23 特別区はそれぞれ独立した「市」相当として扱う
- GPS 投影は各市区町村の bbox 内で正規化 (0-200 SVG 座標)
- 撮影画像は JPEG (q=0.92) + EXIF (撮影日時 + GPS) で保存
