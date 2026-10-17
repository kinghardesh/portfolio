// Links that are safe to show. Anything still marked PLACEHOLDER in profile.json is hidden,
// so the site never shows a button that leads nowhere.
import profile from "./profile.json";

const real = (url: string | undefined) => (url && !url.includes("PLACEHOLDER") ? url : undefined);

const first = profile.name.split(" ")[0];

// Until a booking page (e.g. Cal.com) is set, "Book a call" opens a pre-written email instead.
const callEmail =
  `mailto:${profile.email}?subject=${encodeURIComponent(`Call with ${first}`)}` +
  `&body=${encodeURIComponent(
    `Hi ${first},\n\nI saw your portfolio and would like to set up a short call about:\n\n\n` +
      `Times that work for me (with time zone):\n\n\nThanks!`,
  )}`;

export const links = {
  email: `mailto:${profile.email}`,
  github: real(profile.links.github),
  linkedin: real(profile.links.linkedin),
  booking: real(profile.links.booking) ?? callEmail,
  /** True when booking opens a real scheduling page rather than an email. */
  hasBookingPage: Boolean(real(profile.links.booking)),
};
