import { Suspense } from "react";
import SearchPageClient from "./components/SearchPageClient";

export default function Home() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-zinc-50 px-6 py-16 text-zinc-600">
          로딩 중...
        </div>
      }
    >
      <SearchPageClient />
    </Suspense>
  );
}
