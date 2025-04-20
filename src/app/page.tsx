import dynamic from 'next/dynamic';

// Use dynamic import with SSR disabled since the component uses browser APIs
const AIGameShow = dynamic(() => import('@/components/AIGameShow'), { 
  ssr: false 
});

export default function Home() {
  return (
    <main>
      <AIGameShow />
    </main>
  );
}