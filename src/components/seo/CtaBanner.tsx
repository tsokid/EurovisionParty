import LocaleLink from './LocaleLink';

interface Props {
  title: string;
  body: string;
  primary: { label: string; href: string };
  secondary?: { label: string; href: string };
}

export default function CtaBanner({ title, body, primary, secondary }: Props) {
  return (
    <aside
      className="rounded-2xl border border-white/10 bg-gradient-to-br from-euro-purple/30 via-euro-purple-dark/40 to-euro-pink/20 px-6 py-10 sm:px-10 sm:py-12 text-center"
      role="complementary"
    >
      <h2 className="text-2xl sm:text-3xl font-bold text-white mb-2">{title}</h2>
      <p className="text-white/75 max-w-xl mx-auto mb-6">{body}</p>
      <div className="flex flex-wrap gap-3 justify-center">
        <LocaleLink
          to={primary.href}
          className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-gradient-to-r from-euro-purple-light to-euro-pink text-white font-bold hover:opacity-95 transition shadow-lg shadow-euro-pink/20"
        >
          ✨ {primary.label}
        </LocaleLink>
        {secondary && (
          <LocaleLink
            to={secondary.href}
            className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-white/[0.06] border border-white/15 text-white font-bold hover:bg-white/10 transition"
          >
            {secondary.label}
          </LocaleLink>
        )}
      </div>
    </aside>
  );
}
