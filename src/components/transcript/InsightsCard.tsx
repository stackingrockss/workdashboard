'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Copy, Check } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';

interface InsightsCardProps {
  title: string;
  items: string[];
  emptyMessage?: string;
  icon?: React.ReactNode;
  variant?: 'pain' | 'goal' | 'next';
}

export function InsightsCard({
  title,
  items,
  emptyMessage = 'No items found',
  icon,
  variant = 'goal',
}: InsightsCardProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    const text = items.map((item, idx) => `${idx + 1}. ${item}`).join('\n');
    navigator.clipboard.writeText(text);
    setCopied(true);
    toast.success('Copied to clipboard');
    setTimeout(() => setCopied(false), 2000);
  };

  const variantStyles = {
    pain: 'border-orange-200 dark:border-orange-800',
    goal: 'border-blue-200 dark:border-blue-800',
    next: 'border-green-200 dark:border-green-800',
  };

  return (
    <Card className={variantStyles[variant]}>
      <CardHeader className='flex flex-row items-center justify-between'>
        <CardTitle className='flex items-center gap-2'>
          {icon}
          {title}
        </CardTitle>
        {items.length > 0 && (
          <Button
            variant='ghost'
            size='sm'
            onClick={handleCopy}
            className='h-8 w-8 p-0'
          >
            {copied ? (
              <Check className='h-4 w-4 text-green-600' />
            ) : (
              <Copy className='h-4 w-4' />
            )}
          </Button>
        )}
      </CardHeader>
      <CardContent>
        {items.length === 0 ? (
          <p className='text-sm text-muted-foreground'>{emptyMessage}</p>
        ) : (
          <ul className='space-y-2'>
            {items.map((item, idx) => (
              <li key={idx} className='text-sm'>
                <span className='font-medium'>{idx + 1}.</span> {item}
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
