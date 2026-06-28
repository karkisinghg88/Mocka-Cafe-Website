import LegalShell, { Section } from '../components/LegalShell'
import { CAFE } from '../lib/format'

export default function Privacy() {
  return (
    <LegalShell title="Privacy policy" updated="28 June 2026">
      <p>
        Your privacy matters to us. This policy explains what {CAFE.name} collects when you use this website, why
        we collect it, and the choices you have. We keep it simple and we only collect what we need to serve you.
      </p>

      <Section title="What we collect">
        <p>We collect the details you give us and a few things needed to run your order:</p>
        <p>
          Your name, phone number and email so we can set up your account and reach you. Your delivery address and,
          if you choose to share it, your map location so the rider can find you. Your order history and food
          ratings. Basic technical data such as your login session, kept on your device to keep you signed in.
        </p>
      </Section>

      <Section title="Why we use it">
        <p>
          We use your information to take and prepare your orders, deliver them, handle cash or UPI payment on
          delivery, show you your past orders, improve our menu and service from ratings, and contact you about an
          order when needed. We do not use it for anything unrelated to running the cafe.
        </p>
      </Section>

      <Section title="Who can see it">
        <p>
          Only our cafe team sees what they need to do their job. Kitchen staff see the items to cook. The rider
          assigned to your delivery sees your name, phone and address for that delivery. The owner can see order
          and account records to run the business. We do not sell your data or share it for advertising.
        </p>
      </Section>

      <Section title="Payments">
        <p>
          Payment is taken in person by cash or UPI on delivery. We do not collect or store your card or bank
          account numbers on this website.
        </p>
      </Section>

      <Section title="Where it is stored">
        <p>
          Your data is stored securely with our hosting and database provider and is protected by access controls
          so that one customer cannot see another customer's orders or details. We keep order records as long as
          needed to run the business and meet normal record keeping needs.
        </p>
      </Section>

      <Section title="Your choices">
        <p>
          You can ask to see, correct or delete your account and personal details. You can choose not to share your
          live location and type your address instead. To make any of these requests, call us on {CAFE.phoneDisplay}.
          We will act on reasonable requests promptly.
        </p>
      </Section>

      <Section title="Cookies and local storage">
        <p>
          We use your browser's local storage to keep you signed in and to remember your cart. We do not use
          third party advertising trackers on this website.
        </p>
      </Section>

      <Section title="Children">
        <p>
          This service is meant for adults placing food orders. We do not knowingly collect data from children.
        </p>
      </Section>

      <Section title="Changes and contact">
        <p>
          We may update this policy and will post the latest version here with its date. For any privacy question,
          call {CAFE.phoneDisplay} or visit us at {CAFE.address}.
        </p>
      </Section>
    </LegalShell>
  )
}
