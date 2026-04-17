type AuthCardProps = {
  title: string;
  description: string;
  children: React.ReactNode;
  size?: "sm" | "md" | "lg";
};

const sizeMap: Record<NonNullable<AuthCardProps["size"]>, string> = {
  sm: "max-w-sm",
  md: "max-w-md",
  lg: "max-w-xl",
};

export function AuthCard({ title, description, children, size = "md" }: AuthCardProps) {
  return (
    <div className={`w-full ${sizeMap[size]}`}>
      <div className="mb-6 text-center sm:mb-8">
        <p className="text-[10px] font-semibold uppercase tracking-[0.3em] text-brand-red sm:text-xs">
          Area segura
        </p>
        <h1 className="mt-3 text-3xl font-black uppercase text-white sm:text-4xl">
          {title}
        </h1>
        <p className="mx-auto mt-3 max-w-sm text-sm leading-6 text-brand-gray-light">
          {description}
        </p>
      </div>

      <div className="rounded-3xl border border-brand-gray-mid bg-brand-gray-dark/95 p-6 shadow-[0_20px_80px_rgba(0,0,0,0.45)] backdrop-blur sm:rounded-[2rem] sm:p-8">
        {children}
      </div>
    </div>
  );
}
