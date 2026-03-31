type SectionHeadingProps = {
  eyebrow?: string;
  title: string;
  description: string;
  align?: "left" | "center";
};

export function SectionHeading({
  eyebrow,
  title,
  description,
  align = "left",
}: SectionHeadingProps) {
  return (
    <div className={align === "center" ? "text-center" : ""}>
      {eyebrow ? (
        <p className="text-xs uppercase tracking-[0.3em] text-brand-gray-light">
          {eyebrow}
        </p>
      ) : null}
      <h2 className="mt-3 text-3xl font-bold uppercase leading-none text-white sm:text-4xl md:text-5xl">
        {title}
      </h2>
      <p
        className={[
          "mt-4 max-w-2xl text-sm leading-6 text-brand-gray-light sm:text-base",
          align === "center" ? "mx-auto" : "",
        ].join(" ")}
      >
        {description}
      </p>
    </div>
  );
}
