import { NextResponse } from 'next/server';
import CheXagent from '../../lib/chexagent';

export async function POST(req) {
  try {
    const { imageUrl, indication } = await req.json();
    
    // Initialize CheXagent
    const chexagent = new CheXagent();
    
    // Generate findings
    const findings = await chexagent.findings_generation([imageUrl], indication);
    
    // Generate section by section analysis
    const sectionAnalysis = await chexagent.findings_generation_section_by_section([imageUrl]);
    
    // Get view classification
    const view = await chexagent.view_classification(imageUrl);
    
    return NextResponse.json({
      findings,
      sectionAnalysis,
      view,
      success: true
    });
  } catch (error) {
    console.error('Error processing request:', error);
    return NextResponse.json(
      { error: 'Failed to process the image', success: false },
      { status: 500 }
    );
  }
} 