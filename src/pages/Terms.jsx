import LegalShell, { Section } from '../components/LegalShell'
import { CAFE } from '../lib/format'

export default function Terms() {
  return (
    <LegalShell title="Terms of service" updated="28 June 2026">
      <p>
        Welcome to {CAFE.name}. By creating an account or placing an order through this website you agree to
        these terms. Please read them carefully. If you do not agree, please do not use the service.
      </p>

      <Section title="Who we are">
        <p>
          {CAFE.name} is a cafe located at {CAFE.address}. You can reach us on {CAFE.phoneDisplay}.
          This website lets you browse our menu and place orders for delivery or pickup.
        </p>
      </Section>

      <Section title="Your account">
        <p>
          You need an account to order. Please give a correct name, phone number and delivery address so we can
          reach you and deliver your food. You are responsible for keeping your password safe and for activity on
          your account. Tell us at once if you think someone else is using it.
        </p>
      </Section>

      <Section title="Orders and acceptance">
        <p>
          When you place an order it is a request to buy. We confirm and start preparing once our team accepts it.
          We may decline or cancel an order if an item is sold out, the address is outside our delivery area, the
          cafe is closed, or the details look incorrect. If an item is not available we will contact you to adjust
          the order before cooking.
        </p>
      </Section>

      <Section title="Hours and delivery area">
        <p>
          We take orders during our open hours, {CAFE.hours}. We deliver within about {CAFE.deliveryRadiusKm} km of
          the cafe. Delivery times are estimates and can vary with weather, traffic and how busy we are.
        </p>
      </Section>

      <Section title="Prices and payment">
        <p>
          Prices are shown on the menu in Indian Rupees and include applicable charges unless stated otherwise. A
          delivery charge may apply and is shown before you confirm. You can pay by cash or UPI on delivery. We do
          not store your card or bank details on this website.
        </p>
      </Section>

      <Section title="Cancellations and refunds">
        <p>
          You can cancel before we start cooking by calling us quickly on {CAFE.phoneDisplay}. Once food is being
          prepared it cannot be cancelled. If something is wrong with your order, contact us the same day and we
          will make it right with a replacement or a fair adjustment.
        </p>
      </Section>

      <Section title="Food and allergies">
        <p>
          Our dishes are made fresh in a shared kitchen that handles dairy, gluten, nuts, soy and other
          ingredients. If you have an allergy, please call us before ordering so we can advise. Images on the menu
          are for guidance and actual servings may look a little different.
        </p>
      </Section>

      <Section title="Acceptable use">
        <p>
          Please use this website only to order for yourself. Do not try to break, overload or gain unauthorised
          access to the site, other accounts, or our systems. We may suspend accounts that misuse the service.
        </p>
      </Section>

      <Section title="Our responsibility">
        <p>
          We work hard to keep the menu, prices and the website accurate and available, but we cannot promise it is
          always error free or never interrupted. To the extent allowed by law, our responsibility for any single
          order is limited to the amount you paid for that order.
        </p>
      </Section>

      <Section title="Changes to these terms">
        <p>
          We may update these terms from time to time. The latest version always lives on this page with the date
          it was last updated. Continuing to use the service means you accept the current terms.
        </p>
      </Section>

      <Section title="Contact">
        <p>
          For any question about these terms, call {CAFE.phoneDisplay} or visit us at {CAFE.address}.
        </p>
      </Section>
    </LegalShell>
  )
}
