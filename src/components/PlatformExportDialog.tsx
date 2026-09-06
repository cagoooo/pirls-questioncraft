'use client';

import { useState } from 'react';
import type { GeneratePirlsQuestionsOutput } from '@/lib/api';
import { PLATFORM_NAMES, TIME_OPTIONS, cloneQuestionSet, downloadPlatformWorkbook, downloadTeacherBackup, validateExport, type ExportPlatform } from '@/lib/platformExports';
import { downloadReadingPdf, type ReadingSource } from '@/lib/generateReadingPdf';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { PillBtn } from './Neo';
import { useToast } from '@/hooks/use-toast';

const GUIDES: Record<ExportPlatform, { text: string; url: string }> = {
  wayground: { text: '在 Wayground 建立測驗，選擇匯入試算表。匯入後請核對題數、答案與解析。', url: 'https://help.wayground.com/support/solutions/articles/158000462332-create-an-assessment-quiz' },
  loilonote: { text: '在測驗卡選擇檔案匯入。此為九欄相容格式；請先檢查匯入預覽，再建立題目。', url: 'https://help.loilonote.app/--69d8605c370c4b28fb4700b1' },
  wordwall: { text: '建立 Quiz，逐題貼入題幹與四個選項，再勾選正確答案。此表格是人工貼題用，不是直接匯入檔。', url: 'https://wordwall.zendesk.com/hc/en-gb/articles/360015811938--How-to-create-a-Quiz-activity' },
  kahoot: { text: '建立 Kahoot → 新增問題 → 匯入試算表。匯入後核對題數與答案；解析另外保存在教師備份。', url: 'https://support.kahoot.com/hc/en-us/articles/115002812547-How-to-import-questions-from-a-spreadsheet-to-your-kahoot' },
};

export function PlatformExportDialog({ data, readingSource, disabled }: { data: GeneratePirlsQuestionsOutput; readingSource: ReadingSource; disabled?: boolean }) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [platform, setPlatform] = useState<ExportPlatform>('wayground');
  const [draft, setDraft] = useState(() => cloneQuestionSet(data));
  const [seconds, setSeconds] = useState(60);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState('');
  const issues = validateExport(draft, platform, seconds);
  const errors = issues.filter(i => i.severity === 'error');
  const invalidQuestions = new Set(errors.filter(i => i.question > 0).map(i => i.question));
  const readyCount = errors.some(i => !i.question) ? 0 : draft.questions.length - invalidQuestions.size;

  async function run(action: () => Promise<void> | void, success: string) {
    if (busy) return;
    setBusy(true); setStatus('正在準備檔案…');
    try { await action(); setStatus(success); }
    catch (e) { setStatus(`未完成：${e instanceof Error ? e.message : '請稍後再試。'}`); }
    finally { setBusy(false); }
  }
  async function copy(text: string) {
    try { await navigator.clipboard.writeText(text); setStatus('已複製，請貼到 Wordwall 對應欄位。'); }
    catch { setStatus('無法自動複製，請選取欄位文字後手動複製。'); }
  }
  function edit(index: number, field: 'question' | 'option' | 'answer', value: string, option = 0) {
    setDraft(current => ({ ...current, questions: current.questions.map((q, i) => i !== index ? q : {
      ...q,
      ...(field === 'question' ? { question: value } : field === 'answer' ? { correctAnswerIndex: Number(value) } : { options: q.options.map((s, j) => j === option ? value : s) }),
    }) }));
    setStatus('');
  }

  return <Dialog open={open} onOpenChange={value => {
    if (busy) return;
    if (value) { setDraft(cloneQuestionSet(data)); setStatus(''); }
    setOpen(value);
  }}>
    <DialogTrigger asChild><PillBtn color="bg-sage" sm disabled={disabled}>📦 更多平台／閱讀素材</PillBtn></DialogTrigger>
    <DialogContent className="w-[calc(100%-1.5rem)] max-w-3xl max-h-[90dvh] overflow-y-auto rounded-2xl p-4 sm:p-6">
      <DialogHeader>
        <DialogTitle>匯出到教學平台</DialogTitle>
        <DialogDescription>同一份題組，轉成不同平台可使用的檔案。PaGamO 兩種格式仍可從主畫面下載。</DialogDescription>
      </DialogHeader>
      <fieldset disabled={busy} className="space-y-4 min-w-0">
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="text-sm font-bold">目標平台
            <select aria-label="目標平台" className="mt-1 block w-full rounded-lg border bg-background p-2" value={platform} onChange={e => { setPlatform(e.target.value as ExportPlatform); setDraft(cloneQuestionSet(data)); setStatus(''); }}>
              {Object.entries(PLATFORM_NAMES).map(([id, name]) => <option key={id} value={id}>{name}</option>)}
            </select>
          </label>
          {(platform === 'wayground' || platform === 'kahoot') && <label className="text-sm font-bold">每題作答時間
            <select aria-label="每題作答時間" className="mt-1 block w-full rounded-lg border bg-background p-2" value={seconds} onChange={e => setSeconds(Number(e.target.value))}>
              {TIME_OPTIONS.map(n => <option key={n} value={n}>{n} 秒{n === 60 ? '（閱讀題建議）' : ''}</option>)}
            </select>
          </label>}
        </div>
        <p className="rounded-lg bg-sky/40 p-3 text-sm">{GUIDES[platform].text} <a className="underline" href={GUIDES[platform].url} target="_blank" rel="noreferrer">查看官方說明</a></p>
        {platform === 'kahoot' && <p className="text-sm rounded-lg bg-lemon/40 p-3">Kahoot 官方說明與範本的字數限制不同。目前採保守設定：題幹 95 字、選項 60 字（部分特殊字元可能計為兩字）。超長內容可在下方修改匯出副本，不會自動截字。</p>}
        <p className="text-sm">這些格式不會自動帶入共用文章或原圖。請另下載「學生閱讀素材」，供學生閱讀；圖片來源會保留原圖。解析與 PIRLS 層次可保存在教師備份。</p>
        <div className="flex flex-wrap gap-2">
          <PillBtn sm disabled={busy} onClick={() => run(() => downloadReadingPdf(readingSource, toast), '學生閱讀素材已開始下載（不含題目解答）。')}>📄 學生閱讀素材 PDF</PillBtn>
          <PillBtn sm disabled={busy} onClick={() => run(() => downloadTeacherBackup(data, draft, platform), '教師備份已開始下載，含原題與目前匯出副本。原圖請另保存閱讀素材 PDF。')}>💾 教師題庫備份</PillBtn>
        </div>
        <p className="font-bold" aria-live="polite">{readyCount}／{draft.questions.length} 題通過格式檢查</p>
        {!!issues.length && <ul className="space-y-1 text-sm rounded-lg border p-3 max-h-36 overflow-y-auto">
          {issues.map((issue, i) => <li key={i} className={issue.severity === 'error' ? 'text-destructive' : 'text-muted-foreground'}>{issue.severity === 'error' ? '需調整' : '提醒'}{issue.question ? `・第 ${issue.question} 題` : ''}：{issue.message}</li>)}
        </ul>}
        <details>
          <summary className="cursor-pointer font-bold">檢視／調整匯出副本{platform === 'wordwall' ? '，逐欄複製' : ''}</summary>
          <p className="my-2 text-xs text-muted-foreground">原始題庫不會變更。切換平台或重新開啟視窗會重設副本；調整後請確認題意、答案與解析一致。</p>
          <div className="space-y-4">
            {draft.questions.map((q, i) => <div key={i} className="rounded-xl border p-3 space-y-2 min-w-0">
              <label className="block text-sm font-bold">第 {i + 1} 題
                <textarea aria-label={`第 ${i + 1} 題題幹`} className="mt-1 w-full min-h-20 rounded border bg-background p-2 font-normal" value={q.question} onChange={e => edit(i, 'question', e.target.value)} />
              </label>
              {platform === 'wordwall' && <PillBtn sm onClick={() => copy(q.question)}>複製第 {i + 1} 題題幹</PillBtn>}
              {q.options.map((option, j) => <div key={j} className="flex flex-wrap gap-2 items-start">
                <label className="flex-1 min-w-0 text-sm">選項 {'ABCD'[j]}
                  <textarea aria-label={`第 ${i + 1} 題選項 ${'ABCD'[j]}`} className="w-full rounded border bg-background p-2" rows={2} value={option} onChange={e => edit(i, 'option', e.target.value, j)} />
                </label>
                {platform === 'wordwall' && <PillBtn className="mt-5" sm onClick={() => copy(option)}>複製 {'ABCD'[j]}</PillBtn>}
              </div>)}
              <label className="block text-sm font-bold">正確答案
                <select aria-label={`第 ${i + 1} 題正確答案`} value={q.correctAnswerIndex} className="ml-2 rounded border bg-background p-2" onChange={e => edit(i, 'answer', e.target.value)}>
                  {q.options.map((_, j) => <option key={j} value={j}>選項 {'ABCD'[j]}（{j + 1}）</option>)}
                </select>
              </label>
              {platform === 'wordwall' && <p className="text-sm font-bold">請在 Wordwall 勾選：選項 {'ABCD'[q.correctAnswerIndex]}（第 {q.correctAnswerIndex + 1} 項）</p>}
            </div>)}
          </div>
        </details>
        <PillBtn dark disabled={busy || errors.length > 0} onClick={() => run(() => downloadPlatformWorkbook(draft, platform, seconds), '題目檔案已開始下載，請到目標平台匯入並核對預覽。')}>
          {busy ? '處理中…' : platform === 'wordwall' ? '下載 Wordwall 貼題準備表' : `下載 ${PLATFORM_NAMES[platform]} 題目`}
        </PillBtn>
      </fieldset>
      <p role="status" className="text-sm whitespace-pre-wrap break-words">{status}</p>
    </DialogContent>
  </Dialog>;
}
