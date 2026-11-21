import LocaleLink from './LocaleLink';
import { buttonClass } from '../stage';

interface Props {
  title: string;
  body: string;
  primary: { label: string; href: string };
  secondary?: { label: string; href: string };
}

// Closing call to action on the Stage `.card-hero` (FAQ board): left-aligned,
// full-width buttons on mobile, inline from 768px.
export default function CtaBanner({ title, body, primary, secondary }: Props) {
  return (
    <aside
      className="card-hero flex flex-col gap-3 px-5 py-[22px] md:p-8 text-stage-text"
      role="complementary"
    >
      <h2 className="t-h2">{title}</h2>
      <p className="t-body max-w-2xl">{body}</p>
      <div className="flex flex-col md:flex-row md:flex-wrap gap-2.5 mt-1">
        <LocaleLink to={primary.href} className={buttonClass({ className: 'w-full md:w-auto' })}>
          ✨ {primary.label}
        </LocaleLink>
        {secondary && (
          <LocaleLink to={secondary.href} className={buttonClass({ variant: 'ghost', className: 'w-full md:w-auto' })}>
            {secondary.label}
          </LocaleLink>
        )}
      </div>
    </aside>
  );
}
