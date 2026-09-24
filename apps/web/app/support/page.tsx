import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Support | g000st",
  description: "Support for g000st Application",
};

export default function SupportPage() {
  return (
    <div className="min-h-screen bg-gray-50 text-gray-900 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto bg-white p-8 md:p-12 shadow-sm rounded-lg border border-gray-100 text-center">
        <div className="mb-8 text-left">
          <Link href="/" className="text-blue-600 hover:underline text-sm flex items-center gap-1">
            &larr; Back to Home
          </Link>
        </div>

        <h1 className="text-3xl font-bold mb-6">App Support</h1>

        <div className="prose prose-blue max-w-none text-gray-700 space-y-6 mx-auto">
          <p className="text-lg">
            Need help with the <strong>g000st</strong> app? We are here for you!
          </p>

          <div className="bg-blue-50 p-6 rounded-lg mt-8 inline-block text-left w-full max-w-md">
            <h2 className="text-xl font-semibold text-blue-900 mb-2">Contact Us</h2>
            <p className="text-blue-800 mb-4">
              If you have any questions, encounter issues, or have feedback, please reach out to our support team via email:
            </p>
            <a
              href="mailto:Bakrisabagh@hotmail.com"
              className="text-blue-700 font-medium text-lg hover:underline flex items-center gap-2"
            >
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
                <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
              </svg>
              Bakrisabagh@hotmail.com
            </a>
          </div>

          <p className="text-sm text-gray-500 mt-8">
            We aim to respond to all inquiries within 24-48 hours.
          </p>
        </div>
      </div>
    </div>
  );
}
