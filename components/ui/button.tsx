export function Button({ children, className = '', ...props }: any) {
  return (
    <button
      className={\`bg-blue-600 text-white px-4 py-2 rounded \${className}\`}
      {...props}
    >
      {children}
    </button>
  );
}
