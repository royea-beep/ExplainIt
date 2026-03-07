'use client';

import Script from 'next/script';

const PL_CDN = 'https://ftable.co.il/js';
const SUPABASE_URL = 'https://uiyqswnhrbfctafeihdh.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVpeXFzd25ocmJmY3RhZmVpaGRoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI4MTI5OTAsImV4cCI6MjA4ODM4ODk5MH0.w1YYTGyRlt8MVSEYRjv8tqORfP-aYveVry_xxVYaw0w';

export function ProjectLearner() {
  return (
    <>
      <Script src={`${PL_CDN}/pl-tracker.js`} strategy="lazyOnload" />
      <Script src={`${PL_CDN}/pl-engine.js`} strategy="lazyOnload" />
      <Script src={`${PL_CDN}/pl-insights.js`} strategy="lazyOnload" />
      <Script src={`${PL_CDN}/pl-persistence.js`} strategy="lazyOnload" />
      <Script src={`${PL_CDN}/pl-learner.js`} strategy="lazyOnload" />
      <Script
        id="pl-init"
        strategy="lazyOnload"
        dangerouslySetInnerHTML={{
          __html: `
            window.PLTracker = typeof Tracker !== 'undefined' ? Tracker : undefined;
            window.PLEngine = typeof Engine !== 'undefined' ? Engine : undefined;
            window.PLInsights = typeof Insights !== 'undefined' ? Insights : undefined;
            window.PLPersistence = typeof Persistence !== 'undefined' ? Persistence : undefined;
            if (typeof ProjectLearner !== 'undefined') {
              ProjectLearner.init({
                project: 'explainit',
                supabaseUrl: '${SUPABASE_URL}',
                supabaseKey: '${SUPABASE_KEY}',
                features: ['url-input', 'video-gen', 'pdf-gen', 'demo-page', 'languages', 'pipeline'],
                goals: ['generation_start', 'generation_complete', 'download'],
                consent_key: 'ei-cookie-consent',
              });
            }
          `,
        }}
      />
    </>
  );
}
