'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';

type HealthState =
  | { status: 'checking'; message: string }
  | { status: 'ok'; message: string }
  | { status: 'key-valid'; message: string }
  | { status: 'error'; message: string };

const isProbablyValidKeyError = (error: { message?: string; details?: string; status?: number }) => {
  const message = `${error.message ?? ''} ${error.details ?? ''}`.toLowerCase();
  if (message.includes('does not exist') || message.includes('schema cache')) return true;
  if (error.status === 404) return true;
  return false;
};

const isProbablyAuthOrUrlError = (error: { message?: string; details?: string; status?: number }) => {
  const message = `${error.message ?? ''} ${error.details ?? ''}`.toLowerCase();
  if (message.includes('invalid api key') || message.includes('jwt')) return true;
  if (error.status === 401 || error.status === 403) return true;
  return false;
};

export default function HealthPage() {
  const [state, setState] = useState<HealthState>({
    status: 'checking',
    message: 'Supabase 연결 확인 중...',
  });

  useEffect(() => {
    let isMounted = true;

    const run = async () => {
      try {
        const sessionResult = await supabase.auth.getSession();
        if (sessionResult.error && isProbablyAuthOrUrlError(sessionResult.error)) {
          if (!isMounted) return;
          setState({
            status: 'error',
            message: 'URL 또는 키가 올바르지 않습니다. 환경변수를 확인하세요.',
          });
          return;
        }

        const { error } = await supabase.from('non_existing').select('id').limit(1);

        if (!isMounted) return;

        if (!error) {
          setState({ status: 'ok', message: '연결 성공: Supabase 응답이 정상입니다.' });
          return;
        }

        if (isProbablyValidKeyError(error)) {
          setState({
            status: 'key-valid',
            message: '키가 유효합니다. (테이블 없음으로 인한 에러)',
          });
          return;
        }

        if (isProbablyAuthOrUrlError(error)) {
          setState({
            status: 'error',
            message: 'URL 또는 키가 올바르지 않습니다. 환경변수를 확인하세요.',
          });
          return;
        }

        setState({
          status: 'error',
          message: `연결 실패: ${error.message ?? '알 수 없는 오류'}`,
        });
      } catch (err) {
        if (!isMounted) return;
        const message = err instanceof Error ? err.message : '알 수 없는 오류';
        setState({ status: 'error', message: `연결 실패: ${message}` });
      }
    };

    void run();

    return () => {
      isMounted = false;
    };
  }, []);

  return (
    <main className="mx-auto flex min-h-screen max-w-xl flex-col gap-3 px-6 py-10">
      <h1 className="text-2xl font-semibold">Supabase 연결 테스트</h1>
      <p className="text-sm text-gray-500">
        이 페이지는 Supabase 연결을 확인합니다. 로그인 상태와 무관하게 동작합니다.
      </p>
      <div className="rounded-md border p-4">
        <div className="text-sm text-gray-500">상태</div>
        <div className="mt-1 text-lg font-medium">{state.message}</div>
      </div>
    </main>
  );
}
