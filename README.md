This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

## 개발 시작 안내

### 실행 방법

```bash
# 설치
npm install

# 개발 서버
npm run dev

# 프로덕션 빌드
npm run build
```

### 환경변수 (.env.local)

- 루트에 `.env.local` 파일을 생성해 필요한 환경변수를 설정합니다.
- 예시:

```bash
NEXT_PUBLIC_EXAMPLE=your_value
```

### 폴더 구조

- `src/app`: App Router 라우팅, 페이지/레이아웃/로딩/에러 UI
- `src/lib`: 공통 유틸, API 클라이언트, 데이터 처리 로직
- `public`: 정적 자산
