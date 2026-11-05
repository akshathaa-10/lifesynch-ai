/**
 * Cleans raw email or calendar descriptions by stripping forwarded headers,
 * email disclaimers, signatures, and HTML artifacts.
 */
export function cleanEmailDescription(rawText?: string | null): string {
  if (!rawText) return '';

  let text = rawText;

  // 1. Remove HTML tags and common entities
  text = text.replace(/<[^>]+>/g, ' ');
  text = text.replace(/&nbsp;/gi, ' ');
  text = text.replace(/&amp;/gi, '&');
  text = text.replace(/&lt;/gi, '<');
  text = text.replace(/&gt;/gi, '>');
  text = text.replace(/&quot;/gi, '"');
  text = text.replace(/&#39;/gi, "'");

  // 2. Strip forwarded message header blocks
  // e.g. "---------- Forwarded message ---------\nFrom: ...\nDate: ...\nSubject: ...\nTo: ..."
  text = text.replace(/-{3,}\s*(forwarded message|original message)\s*-{3,}[\s\S]*?(From:|Subject:|Date:|To:)[^\n]*\n([^\n]*\n)?([^\n]*\n)?([^\n]*\n)?/gi, '');
  text = text.replace(/^(From|To|Date|Subject|Sent):\s*[^\n]+\n/gim, '');
  text = text.replace(/On\s+[A-Za-z]+,\s+[A-Za-z]+\s+\d+,\s+\d{4}[^:]+wrote:/gi, '');

  // 3. Strip common signature blocks and disclaimers
  text = text.replace(/\n\s*--\s*\n[\s\S]*$/gi, '');
  text = text.replace(/\n\s*(best regards|warm regards|thanks & regards|thanks and regards|sincerely|cheers|yours truly|regards)[\s\S]*$/gi, '');
  text = text.replace(/Sent from my (iPhone|iPad|Android|Galaxy|mobile device)[\s\S]*$/gi, '');
  text = text.replace(/(This message is intended only for the use of the individual|CONFIDENTIALITY NOTICE|This e-mail and any files transmitted with it are confidential)[\s\S]*$/gi, '');

  // 4. Clean extra whitespace and line breaks
  text = text.replace(/[ \t]+/g, ' ');
  text = text.replace(/\n\s*\n\s*\n+/g, '\n\n');
  return text.trim();
}

/**
 * Derives a specific, meaningful next step from the obligation title and current action,
 * preventing generic placeholders such as "Updates", "Announcements", "Useful Information".
 */
export function deriveSpecificNextStep(
  title: string,
  currentAction?: string | null,
  isInformational?: boolean
): { nextStep: string; isInformational: boolean } {
  const cleanAction = (currentAction || '').trim();
  const lower = cleanAction.toLowerCase();

  const isGeneric = 
    !cleanAction ||
    lower === 'updates' ||
    lower === 'announcements' ||
    lower === 'useful information' ||
    lower === 'updates, announcements and useful information' ||
    lower === 'review' ||
    lower === 'check' ||
    lower === 'action required' ||
    lower === 'review responsibility' ||
    lower === 'none' ||
    lower === 'n/a' ||
    lower === 'fyi' ||
    lower.startsWith('no action') ||
    lower.includes('no action required') ||
    lower.includes('informational only');

  if (!isGeneric) {
    return { nextStep: cleanAction, isInformational: false };
  }

  const titleLow = (title || '').toLowerCase();

  if (titleLow.includes('placement') || titleLow.includes('internship') || titleLow.includes('campus drive') || titleLow.includes('interview schedule')) {
    return { nextStep: 'Review the updated placement schedule.', isInformational: false };
  }
  if (titleLow.includes('exam') || titleLow.includes('timetable') || titleLow.includes('datesheet') || titleLow.includes('midterm') || titleLow.includes('endsem')) {
    return { nextStep: 'Check the examination timetable and note the important dates.', isInformational: false };
  }
  if (titleLow.includes('document') || titleLow.includes('guidelines') || titleLow.includes('circular') || titleLow.includes('instruction') || titleLow.includes('handbook') || titleLow.includes('policy')) {
    return { nextStep: 'Review the shared document for important instructions.', isInformational: false };
  }
  if (titleLow.includes('register') || titleLow.includes('registration') || titleLow.includes('form') || titleLow.includes('enroll') || titleLow.includes('apply')) {
    return { nextStep: 'Complete and submit the registration form.', isInformational: false };
  }
  if (titleLow.includes('fee') || titleLow.includes('payment') || titleLow.includes('tuition') || titleLow.includes('dues') || titleLow.includes('invoice') || titleLow.includes('receipt')) {
    return { nextStep: 'Review payment details and settle outstanding dues.', isInformational: false };
  }
  if (titleLow.includes('meeting') || titleLow.includes('review') || titleLow.includes('viva') || titleLow.includes('session') || titleLow.includes('workshop') || titleLow.includes('seminar') || titleLow.includes('webinar')) {
    return { nextStep: 'Attend the scheduled session.', isInformational: false };
  }
  if (titleLow.includes('assignment') || titleLow.includes('homework') || titleLow.includes('submission') || titleLow.includes('project report')) {
    return { nextStep: 'Complete and submit the requested assignment.', isInformational: false };
  }
  if (titleLow.includes('result') || titleLow.includes('score') || titleLow.includes('grade')) {
    return { nextStep: 'Check published results and feedback.', isInformational: false };
  }

  if (isInformational || lower.includes('informational') || lower.startsWith('no action')) {
    return { nextStep: 'Informational notice — no action required', isInformational: true };
  }

  return { nextStep: 'Review details for any required action.', isInformational: false };
}

