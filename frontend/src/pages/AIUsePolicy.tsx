import React from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'

const sections = [
  {
    number: 1,
    title: 'Purpose',
    content: (
      <p>
        This policy describes the governance framework for automated and computational methods used
        within the Afarensis platform ("Platform"). It establishes the boundaries, controls, and
        transparency requirements that apply to all automated processing capabilities.
      </p>
    ),
  },
  {
    number: 2,
    title: 'Scope',
    content: (
      <p>
        This policy applies to all automated processing, pattern detection, classification, and
        optimization capabilities within the Platform. It covers both current capabilities and the
        governance process for evaluating and deploying new automated functionality.
      </p>
    ),
  },
  {
    number: 3,
    title: 'Core Principles',
    content: (
      <>
        <p>All computational methods within the Platform adhere to the following principles:</p>
        <ul>
          <li>
            All statistical results are produced by deterministic, auditable, and reproducible
            methods.
          </li>
          <li>
            No automated system modifies cohort definitions, analysis specifications, or statistical
            outputs without explicit user execution.
          </li>
          <li>
            All computational methods are versioned, logged, and fully traceable within the
            Platform's audit trail.
          </li>
          <li>
            Human review is required before any result is finalized or exported from the Platform.
          </li>
        </ul>
      </>
    ),
  },
  {
    number: 4,
    title: 'What Automation Does',
    content: (
      <>
        <p>Automated capabilities within the Platform are limited to supportive functions:</p>
        <ul>
          <li>Workflow orchestration and task sequencing</li>
          <li>Format validation and data conformance checking</li>
          <li>Schema detection and mapping assistance</li>
          <li>Literature search indexing and reference organization</li>
          <li>Audit trail generation and event logging</li>
          <li>Notification and status tracking</li>
        </ul>
      </>
    ),
  },
  {
    number: 5,
    title: 'What Automation Does NOT Do',
    content: (
      <>
        <p>
          The following activities are explicitly outside the scope of automated processing within
          the Platform:
        </p>
        <ul>
          <li>Generate primary statistical results or effect estimates</li>
          <li>Modify locked analysis specifications or protocols</li>
          <li>Alter cohort definitions or inclusion/exclusion criteria</li>
          <li>Make regulatory recommendations or strategy determinations</li>
          <li>Produce clinical interpretations of study findings</li>
          <li>Replace or override biostatistical judgment</li>
        </ul>
        <p>
          All analytical decisions remain under the direct control and responsibility of qualified
          users.
        </p>
      </>
    ),
  },
  {
    number: 6,
    title: 'Customer Data Restrictions',
    content: (
      <>
        <p>
          Customer study data is never used to train, fine-tune, or improve automated systems unless
          the customer provides explicit written authorization.
        </p>
        <p>Where such authorization is granted, the following requirements apply:</p>
        <ul>
          <li>
            <strong>Explicit scope</strong> — the authorization must specify which data and which
            purposes are covered
          </li>
          <li>
            <strong>De-identification method</strong> — data must be de-identified using methods
            consistent with HIPAA Safe Harbor or equivalent standards before any use
          </li>
          <li>
            <strong>Access controls</strong> — access to authorized data is restricted to designated
            personnel and systems
          </li>
          <li>
            <strong>Retention limits</strong> — authorized data is retained only for the duration
            specified in the authorization
          </li>
          <li>
            <strong>Right to withdraw</strong> — the customer may withdraw authorization at any
            time, and previously provided data will be removed from use
          </li>
        </ul>
      </>
    ),
  },
  {
    number: 7,
    title: 'Governance',
    content: (
      <>
        <p>
          Synthetic Ascension maintains an internal review process for all automated capabilities
          within the Platform:
        </p>
        <ul>
          <li>
            An internal review board evaluates any proposed new automated capability before
            development begins
          </li>
          <li>
            A risk assessment is completed before any automated capability is deployed to production
          </li>
          <li>
            All changes to automated capabilities are documented through formal change control
            procedures
          </li>
          <li>
            Periodic reviews are conducted to assess the continued appropriateness and performance
            of deployed capabilities
          </li>
        </ul>
      </>
    ),
  },
  {
    number: 8,
    title: 'Transparency',
    content: (
      <>
        <p>
          Every automated processing step within the Platform is labeled in the audit trail.
          Users can inspect the inputs, logic, and outputs of any automated step at any time.
        </p>
        <p>
          Where automated methods are applied, the Platform clearly identifies which steps were
          automated and which were performed by the user. This distinction is preserved in all
          exported artifacts and regulatory documentation.
        </p>
      </>
    ),
  },
  {
    number: 9,
    title: 'Contact',
    content: (
      <p>
        For questions regarding this policy or the computational methods used within the Platform,
        contact us at{' '}
        <a
          href="mailto:compliance@syntheticascension.com"
          className="text-blue-600 dark:text-blue-400 underline"
        >
          compliance@syntheticascension.com
        </a>
        .
      </p>
    ),
  },
]

export default function AIUsePolicy() {
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
            Computational Methods &amp; Automation Policy
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
