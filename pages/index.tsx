import Head from 'next/head'

export default function Home() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-900 text-white">
      <Head>
        <title>AI Circle Starter</title>
      </Head>
      <h1 className="text-4xl font-bold">Your project is wired up 🎉</h1>
    </div>
  );
}
