import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar, ResponsiveContainer } from 'recharts';
import Badge from '../components/ui/Badge';
import api from '../lib/axios';
import useStore from '../store';
import pageStyles from './Page.module.css';
import styles from './DecisionDNA.module.css';

interface DecisionDNAProfile {
  user_id: string;
  org_id: string;
  risk_tolerance_score: number;
  speed_vs_accuracy_score: number;
  cash_strategy_type: 'aggressive' | 'balanced' | 'conservative';
  ai_alignment_rate: number;
  override_patterns: string[];
  decision_style_summary: string;
  adaptations: string[];
}

const MOCK_PROFILE: DecisionDNAProfile = {
  user_id: 'user-1',
  org_id: 'org-1',
  risk_tolerance_score: 46,
  speed_vs_accuracy_score: 72,
  cash_strategy_type: 'conservative',
  ai_alignment_rate: 78,
  override_patterns: ['Overrides tend toward conservative options'],
  decision_style_summary: 'You favor steady cash preservation and avoid high-variance bets. When risk is high, you move quickly but still require clear downside controls.',
  adaptations: [
    'Weights conservative options higher in recommendations',
    'Calibrates confidence using your 78% AI alignment rate',
  ],
};

const DecisionDNA: React.FC = () => {
  const user = useStore((s) => s.user);
  const userId = user?.id || 'user-1';

  const { data: profile = MOCK_PROFILE } = useQuery<DecisionDNAProfile>({
    queryKey: ['decision-dna', userId],
    queryFn: () => api.get(`/api/user/decision-profile/${userId}`).then(r => r.data),
    retry: false,
  });

  const radarData = [
    { axis: 'Risk Tolerance', value: profile.risk_tolerance_score },
    { axis: 'Speed', value: profile.speed_vs_accuracy_score },
    { axis: 'AI Alignment', value: profile.ai_alignment_rate },
  ];

  const styleBadge = `${profile.cash_strategy_type.charAt(0).toUpperCase()}${profile.cash_strategy_type.slice(1)} Strategist`;

  return (
    <div className={pageStyles.page}>
      <div className={pageStyles.content}>
        <div className={pageStyles.pageHeader}>
          <h1 className={pageStyles.pageTitle}>Decision DNA</h1>
          <p className={pageStyles.pageSubtitle}>How the AI adapts to your decision-making style</p>
        </div>

        <div className={styles.panel}>
          <div className={styles.panelHeader}>
            <div className={styles.panelTitle}>Decision Profile</div>
            <div className={styles.panelSubtitle}>Behavioral signals derived from your decision history</div>
          </div>

          <div className={styles.dnaGrid}>
            <div style={{ height: 220 }}>
              <ResponsiveContainer width="100%" height="100%">
                <RadarChart data={radarData}>
                  <PolarGrid stroke="rgba(0,0,0,0.12)" />
                  <PolarAngleAxis dataKey="axis" tick={{ fontSize: 11 }} />
                  <PolarRadiusAxis angle={90} domain={[0, 100]} tick={false} />
                  <Radar dataKey="value" stroke="#0F766E" fill="#14B8A6" fillOpacity={0.35} />
                </RadarChart>
              </ResponsiveContainer>
            </div>

            <div className={styles.badgeCard}>
              <div className={styles.badgeTitle}>Style Badge</div>
              <div className={styles.badgeValue}>{styleBadge}</div>
              <Badge variant="info">AI Alignment {profile.ai_alignment_rate}%</Badge>
              <div className={styles.overrideList}>
                {profile.override_patterns.map((p, i) => (
                  <div key={i} className={styles.overrideItem}>• {p}</div>
                ))}
              </div>
            </div>
          </div>

          <div className={styles.summaryBubble}>{profile.decision_style_summary}</div>

          <div>
            <div className={styles.panelTitle} style={{ fontSize: 13 }}>How AI adapts to you</div>
            <div className={styles.adaptList}>
              {profile.adaptations.slice(0, 2).map((a, i) => (
                <div key={i} className={styles.adaptItem}>• {a}</div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DecisionDNA;
