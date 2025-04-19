export function Input({ className = '', ...props }: any) {
  return (
    <input
      className={`border p-2 rounded w-full ${className}`}
      {...props}
    />
  );
}
