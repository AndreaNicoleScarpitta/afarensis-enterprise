import React from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'

const sections = [
  {
    number: 1,
    title: 'Overview',
    content: (
      <>
        <p>
          This Privacy Policy describes how Synthetic Ascension, Inc. ("Synthetic Ascension," "we,"
          "us," or "our") collects, uses, and protects information in connection with the Afarensis
          platform ("Platform").
        </p>
        <p>
          We are committed to transparency in our data practices. This policy applies to all users
          of the Platform and to all data processed through it.
        </p>
      </>
    ),
  },
  {
    number: 2,
    title: 'Data Categories',
    content: (
      <>
        <h3 className="font-medium text-gray-900 dark:text-gray-100 mb-2">Customer Study Data</h3>
        <p>
          Clinical and real-world data (RWD) uploaded by customers for regulatory evidence review.
          This data is processed solely as directed by the customer. Customer study data is never
          shared across customer organizations and is never used for product training or improvement
          without explicit, written opt-in from the customer.
        </p>

        <h3 className="font-medium text-gray-900 dark:text-gray-100 mb-2 mt-4">
          Platform Usage Data
        </h3>
        <p>
          Aggregated, de-identified telemetry data including feature usage patterns, performance
          metrics, and error rates. This data is used to improve platform reliability and
          performance. Platform usage data never includes protected health information (PHI) or
          study-level data.
        </p>

        <h3 className="font-medium text-gray-900 dark:text-gray-100 mb-2 mt-4">
          Derived Analytics
        </h3>
        <p>
          Aggregated usage patterns across the customer base, such as most-used features and common
          workflow patterns. Derived analytics are used only when not reasonably linkable to any
          individual user or organization.
        </p>
      </>
    ),
  },
  {
    number: 3,
    title: 'How We Use Data',
    content: (
      <>
        <p>We use the data described above to:</p>
        <ul>
          <li>Operate and maintain the Platform</li>
          <li>Maintain platform security and integrity</li>
          <li>Improve platform reliability and performance</li>
          <li>Generate aggregated, de-identified insights for product improvement</li>
        </ul>
        <p className="font-medium text-gray-900 dark:text-gray-100 mt-3">
          We do NOT use customer study data for:
        </p>
        <ul>
          <li>Cross-customer analytics</li>
          <li>Model training or algorithm development</li>
          <li>Any purpose beyond the customer's directed use</li>
        </ul>
        <p>
          Any use of customer study data beyond directed processing requires explicit, written
          authorization from the customer through a separate agreement.
        </p>
      </>
    ),
  },
  {
    number: 4,
    title: 'Learning from Usage',
    content: (
      <p>
        Synthetic Ascension may use de-identified, aggregated platform telemetry to improve platform
        performance, reliability, and feature design. This never includes protected health
        information, patient-level data, or identifiable study content. Telemetry data is
        aggregated in a manner that prevents identification of individual users, organizations, or
        studies.
      </p>
    ),
  },
  {
    number: 5,
    title: 'Data Security',
    content: (
      <>
        <p>
          We implement technical and organizational measures to protect data processed through the
          Platform, including:
        </p>
        <ul>
          <li>Encryption at rest and in transit (AES-256, TLS 1.2+)</li>
          <li>Role-based access controls with least-privilege enforcement</li>
          <li>Comprehensive audit logging of all data access and modifications</li>
          <li>Regular security assessments and penetration testing</li>
          <li>SOC 2 Type II alignment (certification in progress)</li>
        </ul>
      </>
    ),
  },
  {
    number: 6,
    title: 'Data Retention',
    content: (
      <>
        <p>
          Customer data is retained in accordance with the terms of your organization's service
          agreement with Synthetic Ascension.
        </p>
        <p>
          Audit trail records are retained in accordance with applicable regulatory requirements and
          your organization's configuration.
        </p>
        <p>
          Upon termination of a service agreement, customers are provided a data export period.
          Following export or expiration of the export period, customer data is securely deleted
          from active systems and backups within the timeframe specified in the service agreement.
        </p>
      </>
    ),
  },
  {
    number: 7,
    title: 'De-identification',
    content: (
      <p>
        Where de-identification is applied, Synthetic Ascension follows methods consistent with the
        HIPAA Safe Harbor standard. Where linkage is required for traceability purposes, linkage
        tokens are used to maintain referential integrity without exposing direct identifiers.
      </p>
    ),
  },
  {
    number: 8,
    title: 'Your Rights',
    content: (
      <>
        <p>
          Depending on your jurisdiction, you may have rights regarding your personal data,
          including:
        </p>
        <ul>
          <li>
            <strong>Access</strong> — the right to request a copy of your personal data
          </li>
          <li>
            <strong>Correction</strong> — the right to request correction of inaccurate data
          </li>
          <li>
            <strong>Deletion</strong> — the right to request deletion of your personal data
          </li>
          <li>
            <strong>Portability</strong> — the right to receive your data in a structured,
            machine-readable format
          </li>
        </ul>
        <p>
          To exercise any of these rights, contact us at the address provided below. We will
          respond within the timeframes required by applicable law (e.g., GDPR, CCPA).
        </p>
      </>
    ),
  },
  {
    number: 9,
    title: 'Third Parties',
    content: (
      <>
        <p>
          We use third-party infrastructure and service providers to operate the Platform. These
          providers are contractually bound to process data only as we direct and in accordance with
          applicable data protection requirements.
        </p>
        <p>We do not sell customer data to any third party.</p>
        <p>
          A current list of subprocessors is available upon request. We will notify customers of
          material changes to our subprocessor list.
        </p>
      </>
    ),
  },
  {
    number: 10,
    title: 'Changes to This Policy',
    content: (
      <p>
        We may update this Privacy Policy from time to time. We will notify customers of material
        changes via the Platform or through the contact information associated with your account.
        Continued use of the Platform following notification of changes constitutes acceptance of the
        updated policy.
      </p>
    ),
  },
  {
    number: 11,
    title: 'Contact',
    content: (
      <p>
        For questions regarding this Privacy Policy or our data handling practices, contact us at{' '}
        <a
          href="mailto:privacy@syntheticascension.com"
          className="text-blue-600 dark:text-blue-400 underline"
        >
          privacy@syntheticascension.com
        </a>
        .
      </p>
    ),
  },
]

export default function PrivacyPolicy() {
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
            Privacy Policy
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
        <div className="mt-12 pt-6 border-t border-gray-200 dark:border-gray-800 text-center text-xs text-gray-500 dark:text-gray-400 dark:text-gray-500">
          Synthetic Ascension, Inc. All rights reserved.
        </div>
      </div>
    </div>
  )
}
