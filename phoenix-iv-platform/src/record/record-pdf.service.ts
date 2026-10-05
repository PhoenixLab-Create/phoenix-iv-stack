import { Injectable } from '@nestjs/common';
import PDFDocument from 'pdfkit';

/**
 * Renders the PRD §16 "Final Clinical Record" (items 1–14) as a PDF,
 * including an amendment appendix when the record has any. This mirrors
 * exactly what the on-screen record view shows (RecordService) — the PDF
 * is a rendering of that same data, not a second source of truth.
 */
@Injectable()
export class RecordPdfService {
  render(view: { record: any; appliedAmendments: unknown[]; pendingAmendments: unknown[] }): PDFKit.PDFDocument {
    const doc = new PDFDocument({ margin: 50, bufferPages: true });
    const r = view.record;

    const h1 = (text: string) => doc.moveDown(0.5).fontSize(16).font('Helvetica-Bold').text(text).moveDown(0.2);
    const h2 = (text: string) => doc.fontSize(12).font('Helvetica-Bold').text(text).moveDown(0.1);
    const kv = (label: string, value: unknown) =>
      doc.fontSize(10).font('Helvetica').text(`${label}: ${value ?? '—'}`);

    doc.fontSize(18).font('Helvetica-Bold').text('Phoenix Medical Aesthetics — Final Clinical Record', { align: 'center' });
    doc.fontSize(9).font('Helvetica').text(`Visit ID: ${r.id}`, { align: 'center' });
    if (r.signedAt) {
      doc.text(`Signed: ${new Date(r.signedAt).toISOString()}`, { align: 'center' });
    } else {
      doc.fillColor('red').text('NOT YET SIGNED — DRAFT', { align: 'center' }).fillColor('black');
    }

    h1('1. Patient Information');
    kv('Name', `${r.patient.firstName} ${r.patient.lastName}`);
    kv('Date of birth', r.patient.dateOfBirth?.toISOString?.().slice(0, 10) ?? r.patient.dateOfBirth);
    kv('Phone', r.patient.phone);

    h1('2. Medical Intake');
    const answers: Record<string, unknown> = {};
    for (const a of r.intake?.answers ?? []) answers[a.questionKey] = a.answerValue;
    doc.fontSize(10).text(JSON.stringify(answers, null, 2));

    h1('3. Allergies');
    for (const al of r.intake?.allergies ?? []) {
      kv('Has allergy', al.hasAllergy);
      kv('Description', al.description);
    }

    h1('4. Clinical Assessment');
    if (r.assessment) {
      kv('Reason for visit', r.assessment.reasonForVisit);
      kv('Decision', r.assessment.decision);
      kv('Decided by', r.assessment.decidedBy);
      kv('Notes', r.assessment.notes);
    }

    h1('5. Consent');
    if (r.consent) {
      kv('Patient name', r.consent.patientName);
      kv('Signed at', r.consent.signedAt);
      kv('Witness', r.consent.witnessUserId);
    }

    h1('6. IV Protocol');
    if (r.protocolSelection) {
      kv('Protocol', r.protocolSelection.protocol?.name);
      kv('Custom details', r.protocolSelection.customDetails);
    }

    h1('7–8. Ingredients, Lot Numbers and Expiry Dates');
    kv('Base solution', r.preparation?.baseProduct?.name);
    kv('Base volume (mL)', r.preparation?.baseVolumeMl);
    for (const item of r.preparation?.items ?? []) {
      h2(item.product?.name ?? item.productId);
      kv('Dose', `${item.doseValue} ${item.doseUnit}`);
      kv('Lot', item.lot?.lotNumber);
      kv('Expiry', item.lot?.expiryDate?.toISOString?.().slice(0, 10) ?? item.lot?.expiryDate);
    }

    h1('9. IV Insertion');
    if (r.ivInsertion) {
      kv('Site', `${r.ivInsertion.site} (${r.ivInsertion.side})`);
      kv('Gauge', r.ivInsertion.gauge);
      kv('Attempts', r.ivInsertion.attempts);
      kv('Successful', r.ivInsertion.successful);
    }

    h1('10. Infusion Monitoring');
    for (const entry of r.monitoringEntries ?? []) {
      kv(new Date(entry.eventTime).toISOString(), `Tolerating: ${entry.tolerating} — ${entry.symptomsObservation ?? ''}`);
    }

    h1('11. Adverse Events');
    if ((r.adverseEvents ?? []).length === 0) {
      doc.fontSize(10).text('None reported.');
    }
    for (const ev of r.adverseEvents ?? []) {
      h2(`Onset: ${new Date(ev.onsetTime).toISOString()}`);
      kv('Signs/symptoms', ev.signsSymptoms);
      kv('Action taken', ev.infusionAction);
      kv('Outcome', ev.outcome);
      kv('EMS contacted', ev.emsContacted);
      kv('Hospital transfer', ev.hospitalTransfer);
    }

    h1('12. Treatment Completion');
    if (r.completion) {
      kv('End time', r.completion.endTime);
      kv('Total infused (mL)', r.completion.totalInfusedMl);
      kv('Patient condition', r.completion.patientCondition);
      kv('Catheter removed', r.completion.catheterRemoved);
    }

    h1('13. Aftercare');
    kv('Aftercare provided', r.completion?.aftercareProvided);

    h1('14. Clinician Signature');
    if (r.signoff) {
      kv('Signed by', r.signoff.signerId);
      kv('Designation', r.signoff.designation);
      kv('Signed at', r.signoff.signedAt);
      kv('Record hash', r.signoff.recordHash);
    } else {
      doc.fillColor('red').text('UNSIGNED').fillColor('black');
    }

    if (view.appliedAmendments.length || view.pendingAmendments.length) {
      h1('Amendment Appendix');
      doc.fontSize(10).text(
        `${view.appliedAmendments.length} approved amendment(s) applied to this view. ` +
          `${view.pendingAmendments.length} amendment(s) pending approval are NOT reflected above.`,
      );
    }

    doc.end();
    return doc;
  }
}
