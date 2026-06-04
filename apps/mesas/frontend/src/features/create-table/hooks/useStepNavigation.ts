import { useState, useCallback } from 'react';
import type { FormStep, FormState } from '../types/createTable.types';
import { canProceedFromStep, getStepError as getStepErrorUtil } from '../utils/validation';

interface UseStepNavigationReturn {
  step: FormStep;
  maxStepUnlocked: FormStep;
  next: () => void;
  back: () => void;
  goTo: (targetStep: number) => void;
  canProceed: boolean;
  getStepError: string | null;
}

/**
 * Hook para gerenciar navegação entre steps com trava de progresso
 */
export function useStepNavigation(formState: FormState): UseStepNavigationReturn {
  const [step, setStep] = useState<FormStep>(1);
  const [maxStepUnlocked, setMaxStepUnlocked] = useState<FormStep>(1);

  const canProceed = canProceedFromStep(step, formState);
  const getStepError = getStepErrorUtil(step, formState);

  const next = useCallback(() => {
    if (canProceedFromStep(step, formState) && step < 6) {
      const nextStep = (step + 1) as FormStep;
      setStep(nextStep);
      setMaxStepUnlocked((prev) => Math.max(prev, nextStep) as FormStep);
    }
  }, [step, formState]);

  const back = useCallback(() => {
    if (step > 1) {
      setStep((prev) => (prev - 1) as FormStep);
    }
  }, [step]);

  const goTo = useCallback(
    (targetStep: number) => {
      const target = targetStep as FormStep;
      if (target >= 1 && target <= 6 && target <= maxStepUnlocked) {
        setStep(target);
      }
    },
    [maxStepUnlocked]
  );

  return {
    step,
    maxStepUnlocked,
    next,
    back,
    goTo,
    canProceed,
    getStepError,
  };
}
