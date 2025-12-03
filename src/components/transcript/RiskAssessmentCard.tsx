'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle } from 'lucide-react';
import type { RiskAssessment } from '@/types/granola-note';

interface RiskAssessmentCardProps {
  riskAssessment: RiskAssessment;
}

export function RiskAssessmentCard({ riskAssessment }: RiskAssessmentCardProps) {
  const getRiskBadgeColor = (level: string) => {
    switch (level) {
      case 'low':
        return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
      case 'medium':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200';
      case 'high':
        return 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200';
      case 'critical':
        return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200';
    }
  };

  const getCategoryEmoji = (category: string) => {
    const emojiMap: Record<string, string> = {
      budget: '💰',
      timeline: '⏰',
      competition: '🏆',
      technical: '⚙️',
      alignment: '🎯',
      resistance: '🚧',
    };
    return emojiMap[category] || '📊';
  };

  return (
    <Card className='border-orange-200 dark:border-orange-800'>
      <CardHeader>
        <CardTitle className='flex items-center gap-2'>
          <AlertTriangle className='h-5 w-5 text-orange-600' />
          Risk Assessment
        </CardTitle>
      </CardHeader>
      <CardContent className='space-y-4'>
        {/* Overall Risk Level */}
        <div className='flex items-center gap-2'>
          <span className='text-sm font-medium'>Overall Risk:</span>
          <Badge className={getRiskBadgeColor(riskAssessment.riskLevel)}>
            {riskAssessment.riskLevel.toUpperCase()}
          </Badge>
        </div>

        {/* Summary */}
        <div>
          <h4 className='text-sm font-medium mb-1'>Summary</h4>
          <p className='text-sm text-muted-foreground'>
            {riskAssessment.overallSummary}
          </p>
        </div>

        {/* Risk Factors */}
        {riskAssessment.riskFactors.length > 0 && (
          <div>
            <h4 className='text-sm font-medium mb-2'>Risk Factors</h4>
            <div className='space-y-3'>
              {riskAssessment.riskFactors.map((factor, idx) => (
                <div
                  key={idx}
                  className='border rounded-lg p-3 space-y-2'
                >
                  <div className='flex items-center gap-2'>
                    <span className='text-lg'>{getCategoryEmoji(factor.category)}</span>
                    <span className='font-medium text-sm capitalize'>
                      {factor.category}
                    </span>
                    <Badge className={getRiskBadgeColor(factor.severity)}>
                      {factor.severity}
                    </Badge>
                  </div>
                  <p className='text-sm'>{factor.description}</p>
                  <p className='text-xs text-muted-foreground italic'>
                    &ldquo;{factor.evidence}&rdquo;
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

      </CardContent>
    </Card>
  );
}
