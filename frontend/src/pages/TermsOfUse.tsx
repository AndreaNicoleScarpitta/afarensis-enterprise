import React from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'

const sections = [
  {
    number: 1,
    title: 'Acceptance of Terms',
    content: (
      <>
        <p>
          By accessing or using the Afarensis platform ("Platform"), you agree to be bound by these
          Terms of Use ("Terms"). If you do not agree to these Terms, you may not access or use the
          Platform. These Terms constitute a binding agreement between you (or the organization you
          represent) and Synthetic Ascension, Inc. ("Synthetic Ascension," "we," "us," or "our").
        </p>
        <p>
          Your continued use of the Platform following any updates to these Terms constitutes
          acceptance of those changes.
        </p>
      </>
    ),
  },
  {
    number: 2,
    title: 'Platform Description',
    content: (
      <>
        <p>
          Afarensis is a documentation, traceability, and reproducibility platform designed for
          regulatory evidence review in the context of clinical studies and real-world data (RWD)
          analyses.
        </p>
        <p>The Platform is <strong>not</strong>:</p>
        <ul>
          <li>A medical device</li>
          <li>A clinical decision support system</li>
          <li>A regulatory submission tool</li>
        </ul>
        <p>
          The Platform assists in the preparation and documentation of regulatory evidence
          packages. It does not submit, approve, or validate regulatory filings on your behalf.
        </p>
      </>
    ),
  },
  {
    number: 3,
    title: 'Permitted Use',
    content: (
      <>
        <p>The Platform is intended for the following uses:</p>
        <ul>
          <li>Internal regulatory evidence review and assessment</li>
          <li>Study documentation and analysis traceability</li>
          <li>Reproducibility workflows for statistical analyses</li>
          <li>Preparation of regulatory submission packages</li>
        </ul>
        <p>
          Users retain full responsibility for study design, statistical methodology selection,
          interpretation of results, regulatory strategy, and all regulatory submissions. The
          Platform does not replace qualified biostatistical, clinical, or regulatory judgment.
        </p>
      </>
    ),
  },
  {
    number: 4,
    title: 'User Responsibilities',
    content: (
      <>
        <p>As a user of the Platform, you agree to:</p>
        <ul>
          <li>
            Maintain the security of your credentials and notify us immediately of any unauthorized
            access
          </li>
          <li>
            Ensure that all data handling within the Platform complies with applicable laws,
            regulations, and organizational policies
          </li>
          <li>
            Validate the Platform within your environment as required for regulated use, consistent
            with 21 CFR Part 11 and equivalent regulatory frameworks
          </li>
          <li>
            Refrain from uploading data to the Platform without proper authorization from your
            organization and, where applicable, relevant data governance bodies
          </li>
        </ul>
      </>
    ),
  },
  {
    number: 5,
    title: 'Audit Trails & Electronic Records',
    content: (
      <>
        <p>
          The Platform provides audit trail capabilities and electronic signing workflows to support
          traceability and accountability within regulatory evidence review processes.
        </p>
        <p>
          Your organization is responsible for configuring, validating, and maintaining these
          capabilities in accordance with your specific regulatory context and applicable
          requirements (e.g., 21 CFR Part 11, EU Annex 11).
        </p>
      </>
    ),
  },
  {
    number: 6,
    title: 'Intellectual Property',
    content: (
      <>
        <p>
          All intellectual property rights in the Platform, including its software, design,
          documentation, and underlying technology, are owned by Synthetic Ascension and are
          protected by applicable intellectual property laws.
        </p>
        <p>
          You retain full ownership of all study data, analysis outputs, reports, and derived
          artifacts that you upload to or generate within the Platform. Synthetic Ascension claims
          no ownership interest in your content.
        </p>
      </>
    ),
  },
  {
    number: 7,
    title: 'Data Handling',
    content: (
      <>
        <p>
          Our data handling practices are described in detail in our{' '}
          <Link to="/privacy" className="text-blue-600 dark:text-blue-400 underline">
            Privacy Policy
          </Link>
          .
        </p>
        <p>
          Customer data is logically segregated within the Platform. We do not commingle datasets
          across customer organizations. Customer study data is processed solely as directed by
          the customer.
        </p>
      </>
    ),
  },
  {
    number: 8,
    title: 'Limitation of Liability',
    content: (
      <>
        <p>
          The Platform is provided on an "as-is" and "as-available" basis for the purposes of
          documentation, traceability, and reproducibility support.
        </p>
        <p>
          Synthetic Ascension is not liable for regulatory outcomes, submission decisions, clinical
          interpretations, or any consequences arising from the use of outputs generated through the
          Platform. The Platform is not a substitute for qualified biostatistical or regulatory
          judgment.
        </p>
        <p>
          To the maximum extent permitted by applicable law, Synthetic Ascension disclaims all
          warranties, express or implied, and shall not be liable for any indirect, incidental,
          special, consequential, or punitive damages arising out of or related to your use of the
          Platform.
        </p>
      </>
    ),
  },
  {
    number: 9,
    title: 'Indemnification',
    content: (
      <p>
        Each party agrees to indemnify, defend, and hold harmless the other party from and against
        any claims, damages, losses, liabilities, and expenses (including reasonable attorneys'
        fees) arising out of or related to the indemnifying party's breach of these Terms or
        applicable law. Specific indemnification terms will be set forth in your organization's
        master service agreement with Synthetic Ascension.
      </p>
    ),
  },
  {
    number: 10,
    title: 'Termination',
    content: (
      <>
        <p>
          Either party may terminate use of the Platform in accordance with the terms of the
          applicable service agreement.
        </p>
        <p>
          Upon termination, Synthetic Ascension will provide a reasonable data export period during
          which you may retrieve your data. Following the export period, your data will be deleted
          in accordance with our data retention policies, except where retention is required by law
          or regulation.
        </p>
      </>
    ),
  },
  {
    number: 11,
    title: 'Governing Law',
    content: (
      <p>
        These Terms shall be governed by and construed in accordance with the laws of [Jurisdiction].
        Any disputes arising under or in connection with these Terms shall be subject to the
        exclusive jurisdiction of the courts of [Jurisdiction].
      </p>
    ),
  },
  {
    number: 12,
    title: 'Contact',
    content: (
      <p>
        For questions regarding these Terms of Use, contact us at{' '}
        <a
          href="mailto:legal@syntheticascension.com"
          className="text-blue-600 dark:text-blue-400 underline"
        >
          legal@syntheticascension.com
        </a>
        .
      </p>
    ),
  },
]

export default function TermsOfUse() {
  return (
    <div className="min-h-screen bg-white dark:bg-gray-950">
      <div className="max-w-3xl mx-auto px-6 py-12">
        {/* Back link */}
        <Link
          to="/"
          className="inline-flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 mb-8 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Afarensis
        </Link>

        {/* Header */}
        <div className="mb-10">
          <h1 className="text-3xl font-semibold text-gray-900 dark:text-gray-100 mb-2">
            Terms of Use
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">Last updated: March 2026</p>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Afarensis by Synthetic Ascension
          </p>
        </div>

        {/* Sections */}
        <div className="space-y-8">
          {sections.map((section) => (
            <section
              key={section.number}
              className="border border-gray-200 dark:border-gray-800 rounded-lg p-6"
            >
              <h2 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-4">
                {section.number}. {section.title}
              </h2>
              <div className="text-sm text-gray-700 dark:text-gray-300 space-y-3 leading-relaxed [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:space-y-1">
                {section.content}
              </div>
            </section>
          ))}
        </div>

        {/* Footer */}
        <div className="mt-12 pt-6 border-t border-gray-200 dark:border-gray-800 text-center text-xs text-gray-400 dark:text-gray-500">
          Synthetic Ascension, Inc. All rights reserved.
        </div>
      </div>
    </div>
  )
}
