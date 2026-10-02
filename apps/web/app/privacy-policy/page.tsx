import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Privacy Policy | g000st",
  description: "Privacy policy and child safety standards for g000st, including reporting child sexual abuse and exploitation.",
};

export default function PrivacyPolicyPage() {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-night-canvas text-gray-900 dark:text-night-text py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto bg-white dark:bg-night-surface p-8 md:p-12 shadow-sm rounded-lg border border-gray-100 dark:border-night-border">
        <div className="mb-8">
          <Link href="/" className="text-blue-600 dark:text-blue-300 hover:underline text-sm flex items-center gap-1">
            &larr; Back to Home
          </Link>
        </div>
        
        <h1 className="text-3xl font-bold mb-6">Privacy Policy</h1>
        
        <div className="prose prose-blue max-w-none text-gray-700 dark:text-night-muted space-y-6">
          <p className="text-sm text-gray-500 dark:text-night-muted">Last updated: <time dateTime="2026-10-03">October 3, 2026</time></p>
          <p>
            <a href="#child-safety" className="text-blue-600 dark:text-blue-300 hover:underline">Read g000st&apos;s Child Safety Standards</a>
          </p>
          
          <section>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-night-text mb-3">1. Introduction</h2>
            <p>
              Welcome to <strong>g000st</strong>. We respect your privacy and are committed to protecting your personal data. 
              This privacy policy will inform you as to how we look after your personal data when you visit our application and 
              tell you about your privacy rights and how the law protects you.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-night-text mb-3">2. Information We Collect</h2>
            <p>
              We may collect, use, store and transfer different kinds of personal data about you which we have grouped together as follows:
            </p>
            <ul className="list-disc pl-5 mt-2 space-y-1">
              <li><strong>Identity Data:</strong> includes first name, last name, username or similar identifier.</li>
              <li><strong>Contact Data:</strong> includes email address and telephone numbers.</li>
              <li><strong>Technical Data:</strong> includes internet protocol (IP) address, your login data, browser type and version, time zone setting and location, and other technology on the devices you use to access this application.</li>
              <li><strong>Usage Data:</strong> includes information about how you use our application and services.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-night-text mb-3">3. How We Use Your Information</h2>
            <p>We will only use your personal data when the law allows us to. Most commonly, we will use your personal data in the following circumstances:</p>
            <ul className="list-disc pl-5 mt-2 space-y-1">
              <li>Where we need to perform the contract we are about to enter into or have entered into with you.</li>
              <li>Where it is necessary for our legitimate interests (or those of a third party) and your interests and fundamental rights do not override those interests.</li>
              <li>Where we need to comply with a legal or regulatory obligation.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-night-text mb-3">4. Data Security</h2>
            <p>
              We have put in place appropriate security measures to prevent your personal data from being accidentally lost, used, or accessed in an unauthorized way, altered, or disclosed. In addition, we limit access to your personal data to those employees, agents, contractors, and other third parties who have a business need to know.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-night-text mb-3">5. Data Retention</h2>
            <p>
              We will only retain your personal data for as long as necessary to fulfil the purposes we collected it for, including for the purposes of satisfying any legal, accounting, or reporting requirements.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-night-text mb-3">6. Your Legal Rights</h2>
            <p>
              Under certain circumstances, you have rights under data protection laws in relation to your personal data, including the right to request access, correction, erasure, restriction, transfer, to object to processing, to portability of data, and (where the lawful ground of processing is consent) to withdraw consent.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-night-text mb-3">7. Contact Us</h2>
            <p>
              If you have any questions about this privacy policy or our privacy practices, please contact us at: <a href="mailto:Bakrisabagh@hotmail.com" className="text-blue-600 dark:text-blue-300 hover:underline">Bakrisabagh@hotmail.com</a>
            </p>
          </section>

          <section id="child-safety" className="scroll-mt-8 space-y-4" aria-labelledby="child-safety-heading">
            <h2 id="child-safety-heading" className="text-xl font-semibold text-gray-900 dark:text-night-text mb-3">8. g000st Child Safety Standards</h2>
            <p>
              g000st strictly prohibits child sexual abuse and exploitation (CSAE) across its service, including posts, listings, profiles, and private communications. These standards apply to all users, regardless of the service&apos;s intended age audience. For these standards, a child is anyone under 18.
            </p>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-night-text">Prohibited content and conduct</h3>
            <p>
              Users must not create, upload, request, distribute, or facilitate child sexual abuse material (CSAM), including sexual imagery of children and computer-generated depictions. Grooming, sexual solicitation of children, sexual extortion, trafficking for sexual purposes, and any other conduct that sexually abuses, exploits, or endangers children are prohibited.
            </p>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-night-text">How to report a concern</h3>
            <p>
              Use the <strong>Report</strong> action on a social post in the g000st app to flag concerning content for review. For other child safety concerns, including concerns about an account or private communication, email <a href="mailto:Bakrisabagh@hotmail.com?subject=g000st%20child%20safety%20report" className="text-blue-600 dark:text-blue-300 hover:underline">Bakrisabagh@hotmail.com</a>. Include relevant account identifiers or links and a description of your concern. Do not attach, download, or forward suspected CSAM. If a child is in immediate danger, contact local emergency services or law enforcement.
            </p>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-night-text">Review, enforcement, and reporting to authorities</h3>
            <p>
              g000st will review child safety reports and take appropriate action when it becomes aware of violations, including removing confirmed CSAM and restricting or terminating offending accounts. We will handle relevant information in accordance with applicable law and report confirmed CSAM to the National Center for Missing &amp; Exploited Children (NCMEC) or the appropriate regional or national authority, as required by applicable reporting obligations. We will cooperate with lawful requests from competent authorities.
            </p>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-night-text">Child safety contact</h3>
            <p>
              For child safety reports and inquiries about these standards, contact g000st at <a href="mailto:Bakrisabagh@hotmail.com" className="text-blue-600 dark:text-blue-300 hover:underline">Bakrisabagh@hotmail.com</a>.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
