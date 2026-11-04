$ErrorActionPreference='Stop'
$root=(Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$source='C:\Users\USER\OneDrive\Desktop\COS40005 FYP A\FYP_Poster.pptx'
$output=Join-Path $root 'FYP_Poster_Research_Aligned.pptx'
$background=(Resolve-Path (Join-Path $root '..\editable\assets\medical-background.png')).Path
function RGB([string]$h){return [int]([Convert]::ToInt32($h.Substring(0,2),16)+256*[Convert]::ToInt32($h.Substring(2,2),16)+65536*[Convert]::ToInt32($h.Substring(4,2),16))}
$navy=RGB '103B45'; $teal=RGB '087F83'; $purple=RGB '7545AB'; $muted=RGB '425865'; $white=RGB 'FFFFFF'; $line=RGB 'C4DEDF'; $light=RGB 'F0F7F7'
function Rect([string]$name,[double]$x,[double]$y,[double]$w,[double]$h,[int]$fill,[double]$opacity=0){
 $s=$slide.Shapes.AddShape(1,$x,$y,$w,$h);$s.Name=$name;$s.Fill.ForeColor.RGB=$fill;$s.Fill.Transparency=$opacity;$s.Line.Visible=0;return $s
}
function Txt([string]$name,[string]$text,[double]$x,[double]$y,[double]$w,[double]$h,[double]$size,[int]$color,[bool]$bold=$false){
 $s=$slide.Shapes.AddTextbox(1,$x,$y,$w,$h);$s.Name=$name
 $f=$s.TextFrame;$f.MarginLeft=0;$f.MarginRight=0;$f.MarginTop=0;$f.MarginBottom=0;$f.WordWrap=-1;$f.AutoSize=0
 $t=$f.TextRange;$t.Text=$text;$t.Font.Name='Arial';$t.Font.Size=$size;$t.Font.Color.RGB=$color;$t.Font.Bold=if($bold){-1}else{0}
 $t.ParagraphFormat.SpaceBefore=0;$t.ParagraphFormat.SpaceAfter=5
 $s.TextFrame2.AutoSize=0;$s.Height=$h;return $s
}
function Line([string]$name,[double]$x1,[double]$y1,[double]$x2,[double]$y2,[int]$color,[bool]$arrow=$false){
 $s=$slide.Shapes.AddLine($x1,$y1,$x2,$y2);$s.Name=$name;$s.Line.ForeColor.RGB=$color;$s.Line.Weight=2
 if($arrow){$s.Line.EndArrowheadStyle=3};return $s
}
function Section($name,$x,$y,$w,$h,$accent){
 $s=Rect ($name+' panel') $x $y $w $h $white 0.06
 $s.Line.Visible=-1;$s.Line.ForeColor.RGB=$line;$s.Line.Weight=1.3
 $null=Rect ($name+' accent') $x $y 7 49 $accent
 $null=Txt ($name+' heading') $name ($x+22) ($y+9) ($w-44) 44 33 $accent $true
 $null=Line ($name+' heading rule') ($x+22) ($y+58) ($x+$w-22) ($y+58) $line
}
function NativeTable($name,$rows,$widths,$x,$y,$h,$size){
 $w=($widths|Measure-Object -Sum).Sum
 $s=$slide.Shapes.AddTable($rows.Count,$widths.Count,$x,$y,$w,$h);$s.Name=$name;$t=$s.Table
 for($j=0;$j -lt $widths.Count;$j++){$t.Columns.Item($j+1).Width=$widths[$j]}
 for($i=0;$i -lt $rows.Count;$i++){
  for($j=0;$j -lt $widths.Count;$j++){
   $c=$t.Cell($i+1,$j+1);$f=$c.Shape.TextFrame;$f.MarginLeft=9;$f.MarginRight=9;$f.MarginTop=5;$f.MarginBottom=5;$f.VerticalAnchor=3
   $f.TextRange.Text=$rows[$i][$j];$f.TextRange.Font.Name='Arial';$f.TextRange.Font.Size=$size;$f.TextRange.Font.Color.RGB=if($i -eq 0){$white}else{$navy}
   $f.TextRange.Font.Bold=if($i -eq 0 -or ($name -eq 'Long-horizon results' -and $i -eq 3)){-1}else{0}
   $f.TextRange.ParagraphFormat.SpaceAfter=0;$f.TextRange.ParagraphFormat.Alignment=if($j -eq 0){1}else{2}
   $c.Shape.Fill.ForeColor.RGB=if($i -eq 0){$teal}elseif($i%2 -eq 0){$light}else{$white}
   for($b=1;$b -le 4;$b++){$c.Borders.Item($b).ForeColor.RGB=$line;$c.Borders.Item($b).Weight=1}
  }
 }
 return $s
}
function Step($n,$title,$x,$y,$color){
 $null=Rect ('Workflow step '+$n) $x $y 222 104 (RGB 'EFF5F6')
 $null=Txt ('Workflow number '+$n) ('0'+$n) ($x+12) ($y+10) 50 28 20 $color $true
 $null=Txt ('Workflow title '+$n) $title ($x+12) ($y+42) 198 55 21 $navy $true
}
function Method($title,$body,$y){
 $null=Txt ('Method '+$title) $title 877 $y 724 34 24 $teal $true
 $bodySize=if($title -eq 'Application integration and verification'){21}else{22}
 $null=Txt ('Method detail '+$title) $body 877 ($y+39) 724 91 $bodySize $muted
}
$app=$null;$deck=$null
try{
 $app=New-Object -ComObject PowerPoint.Application
 $deck=$app.Presentations.Open($source,$false,$false,$false);$slide=$deck.Slides.Item(1)
 for($i=$slide.Shapes.Count;$i -ge 1;$i--){$s=$slide.Shapes.Item($i);if($s.Name -notin @('Group 4','Group 6')){$s.Delete()}}
 while($deck.Slides.Count -gt 1){$deck.Slides.Item($deck.Slides.Count).Delete()}
 $slide.FollowMasterBackground=0;$slide.Background.Fill.Solid();$slide.Background.Fill.ForeColor.RGB=$white
 $bg=$slide.Shapes.AddPicture($background,0,-1,0,0,1683,2384);$bg.Name='Generated medical background';$bg.ZOrder(1)
 $null=Rect 'Readability overlay' 0 340 1683 2044 $white 0.15
 $logo=$slide.Shapes.Item('Group 6');$logo.LockAspectRatio=-1;$logo.Width=120;$logo.Left=60;$logo.Top=49
 $crest=$slide.Shapes.Item('Group 4');$crest.LockAspectRatio=-1;$crest.Width=133;$crest.Left=1475;$crest.Top=50
 $null=Txt 'Project title' 'Smart Diabetes Digital Twin' 215 58 1235 75 60 $navy $true
 $null=Txt 'Project subtitle' 'Personalised Health Management Platform' 215 139 1235 61 43 $navy $true
 $null=Txt 'Authors' "Andy Wei Jian CHU  |  Fa Zhen NG  |  Jit Heng BOON`rElijah Benjamin Sing Cheng TAN  |  Jody LAW" 217 214 1210 56 21 $muted
 $null=Txt 'Institution' 'Swinburne University of Technology Sarawak Campus' 217 279 1210 32 23 $muted
 $null=Txt 'Supervisor' 'Supervisor: Ts. Dr. Vong Wan Tze' 217 316 1210 29 21 $muted

 # Preserve the original template's two-column section positions and reading order.
 Section 'Introduction' 60 370 773 325 $teal
 Section 'Problem' 60 715 773 475 $purple
 Section 'Results' 60 1210 773 860 $teal
 Section 'References' 60 2090 773 240 $teal
 Section 'Methodology' 853 370 770 1400 $teal
 Section 'Conclusions' 853 1790 770 280 $purple
 Section 'Recommendations' 853 2090 770 240 $teal

 $null=Txt 'Introduction text' "Diabetes care involves changing clinical measurements, lifestyle records and risk factors. Disconnected observations make it difficult to understand how a patient's health state evolves. This project uses the ShanghaiT2DM longitudinal dataset to build a patient-centric digital representation of health over time, bringing patient records, trends, predictive analytics and medical knowledge into a coherent workflow for healthcare professionals and researchers. [1]" 82 445 729 229 22.5 $muted

 $null=Txt 'Problem statement' 'Patient records, risk factors and simulated outcomes need a connected, interpretable view that clearly separates observed health information from model-generated estimates. [1]' 82 790 729 87 22 $muted
 $null=Txt 'Aim label' 'Project aim' 82 890 729 31 23 $purple $true
 $null=Txt 'Project aim text' 'Develop an integrated, patient-centric digital twin that represents changing diabetes health states and connects longitudinal history, risk assessment, explainability, personalised insights, scenario exploration and reporting in one complete workflow. [1]' 82 929 729 123 23 $navy
 $null=Txt 'Objectives label' 'Research and development objectives' 82 1060 729 31 22 $purple $true
 $null=Txt 'Objectives' "1. Link longitudinal records to patient-specific state tracking.`r2. Combine prediction, XAI and knowledge-graph context.`r3. Support monitoring, scenario comparison and reporting." 82 1092 729 91 21 $muted

 $null=Txt 'Initial forecast heading' '15-minute glucose forecasting (mg/dL)' 82 1285 729 35 24 $teal $true
 $rows1=@(@('Metric','GRU','Persistence'),@('MAE','3.81','5.93'),@('RMSE','5.28','8.78'))
 $null=NativeTable 'Next-step results' $rows1 @(363,183,183) 82 1330 132 23
 $null=Txt 'Initial forecast scope' 'Same 22,401 held-out windows; chronological testing on later observations from known records. These are next-step results, not 6 h or 12 h accuracy. [2, Sec. 2.3]' 82 1475 729 72 20 $muted
 $null=Txt 'Trajectory forecast heading' 'Longer-horizon trajectory MAE (mg/dL)' 82 1560 729 35 24 $teal $true
 $rows2=@(@('Method','3 h','6 h','12 h'),@('Persistence','22.91','29.77','34.64'),@('Initial GRU, corrected recursion','22.22','27.66','29.70'),@('Conditional GRU (7 fields)','20.55','22.98','24.77'))
 $null=NativeTable 'Long-horizon results' $rows2 @(351,126,126,126) 82 1606 174 21
 $null=Txt 'Trajectory forecast scope' 'Matched comparison: 108 forecast starting points, without future meal or insulin plans. Unseen-patient generalisation remains untested. [2, Sec. 2.4.1]' 82 1794 729 61 20 $muted
 $null=Txt 'Knowledge graph results heading' 'Knowledge-graph prototype' 82 1872 729 35 24 $teal $true
 $stats=@(@{x=82;n='37';t='medical concepts'},@{x=325;n='42';t='proposed relations'},@{x=568;n='15';t='relation types'})
 foreach($st in $stats){$null=Txt ('Graph count '+$st.n) $st.n $st.x 1917 224 48 39 $teal $true;$null=Txt ('Graph label '+$st.n) $st.t $st.x 1967 224 31 20 $muted}
 $null=Txt 'Knowledge graph status' 'All 42 relationships were candidate_for_review; none were reviewed at the report check. Relationship-based interpretation remains restricted. [2, Secs. 2.5, 3.4]' 82 2007 729 53 20 $muted

 $null=Txt 'Method introduction' 'A modular, iterative approach combines longitudinal data engineering, predictive modelling and traceable medical knowledge. The planned user journey is shown below; advanced stages remain development targets. [1, 2]' 877 445 724 112 23 $muted
 $null=Txt 'Target workflow label' 'Target end-to-end workflow' 877 565 724 35 25 $teal $true
 Step 1 'Select patient' 877 617 $teal
 Step 2 'View health history' 1123 617 $teal
 Step 3 "Assess current`rrisk" 1369 617 $purple
 Step 4 'Explain key factors' 1369 761 $purple
 Step 5 'Personalised insights' 1123 761 $purple
 Step 6 'View digital twin state' 877 761 $purple
 Step 7 'Create what-if scenario' 877 905 $purple
 Step 8 "Compare`routcomes" 1123 905 $purple
 Step 9 'Generate health report' 1369 905 $purple
 foreach($p in @(@(1099,669,1120,669),@(1345,669,1366,669),@(1480,724,1480,758),@(1366,813,1348,813),@(1120,813,1102,813),@(988,868,988,902),@(1099,957,1120,957),@(1345,957,1366,957))){$null=Line 'Workflow connector' $p[0] $p[1] $p[2] $p[3] $teal $true}

 Method 'Data preparation and patient state' 'KNIME standardises patient_summary and patient_detail, retaining identifiers, timestamps, units and missing entries. The source preparation covered 109 workbooks and 112,287 parseable CGM rows. [2, Sec. 2.1]' 1041
 Method 'Predictive modelling and evaluation' 'Train a GRU on 24 historical steps (6 h) to predict the next 15-minute reading. Evaluate against persistence. Investigate a separate conditional model for 12 h trajectories. [2, Secs. 2.3-2.4]' 1187
 Method 'Clinical context and explainability' 'Neo4j stores medical concepts and source-linked relationships with review status. SHAP feature explanations and risk-based personalised insights remain planned objectives, beyond the Sprint 1 prototypes. [1, 2]' 1333
 Method 'Application integration and verification' 'React/TypeScript, Flask and Supabase integrate patient records, monitoring, forecasting and graph views. Test role/assignment access and separate measured, predicted and simulated outputs. [2]' 1479
 $null=Txt 'Method scope note' 'Core twin: data-driven health-state tracking. A 3D body view is a secondary enhancement; autonomous diagnosis and prescription generation are outside scope. [1, Sec. 2.2]' 877 1630 724 102 22 $purple

 $null=Txt 'Conclusions text' 'Sprint 1 established the data and application foundations for the planned patient-centric twin. GRU forecasting improved on persistence in the reported tests, and a traceable knowledge-graph prototype was integrated. These are research-stage results: the complete risk/XAI/insight workflow, unseen-patient forecasting and reliable intervention simulation remain to be completed or validated. [2]' 877 1865 724 180 23 $muted

 $null=Txt 'References text' "[1] Project team. COS40005 Team and Project Plan, 27 September 2026, Part 2.`r[2] Project team. Sprint Report 1, updated 30 October 2026, Secs. 2.1-2.6 and 3.3-3.4.`r[3] Source code: github.com/AA-4499/FYP-A-Sep-2026" 82 2165 729 149 20 $muted
 $null=Txt 'Recommendations text' "Evaluate forecasts on patients excluded from training.`rInvestigate inconsistent meal and insulin responses.`rReview graph evidence; develop risk and SHAP modules.`rComplete scenario, access-control and usability validation." 877 2165 724 149 22 $muted
 $null=Txt 'Poster status footer' 'Project aim and workflow: COS40005 project plan  |  Results: Sprint 1 report, updated 30 October 2026  |  Research prototype' 60 2350 1563 27 17 $muted

 $notes=@"
This revision follows the original poster's spatial section order: Introduction / Problem / Results / References in the left column; Methodology / Conclusions / Recommendations in the right column. It retains the original physical canvas, native university marks, masters and a generated background with a readability overlay. Text, workflow, counts and both result tables are editable PowerPoint objects.
Primary aim authority: C:/Users/USER/OneDrive/Desktop/COS40005 FYP A/COS40005 Team and Project Plan-1-1 (1).docx, Part 2, especially 2.1 problem statement, 2.2 scope, 2.4 system requirements, 2.5 solution approach and 2.6 product backlog. The unrelated Project Plan.docx supplied earlier is excluded per the user's correction.
Results authority: C:/Users/USER/OneDrive/Desktop/COS40005 FYP A/FYP_sprint1_report_update.pdf, updated 30 October 2026. PDF p26 (printed p25): data counts. PDF p30 (printed p29), Table12: next-step GRU/persistence MAE 3.81/5.93, RMSE 5.28/8.78, same 22,401 windows. PDF p32 (printed p31), Table13: persistence 22.91/29.77/34.64; corrected initial GRU 22.22/27.66/29.70; conditional GRU with seven baseline summary fields 20.55/22.98/24.77 across 3/6/12 h. This matched comparison uses 108 origins without future meal or insulin plans; it must not be combined with the separate 1,422-trajectory baseline-summary experiment. PDF pp33-34 and p40: 42 proposed relationships, 37 concepts, 15 relationship types; all 42 candidate_for_review and zero reviewed in the reported query.
The nine-stage workflow describes the project target, not a claim of completion. Sprint1 forecasting and knowledge-graph progress is separated from planned risk assessment, SHAP, personalised insight delivery, complete state/simulation workflow and reporting. A 3D human representation is a secondary enhancement. No regulatory-compliance, clinical-effectiveness, autonomous-diagnosis, prescription or causal treatment-effect claims are made. User requested smaller type and a return to original section order; the visual colours/background may change. Prior version's separate Doctor Digital twin menu remains removed in code; this artifact change does not modify or push website code.
"@
 $slide.NotesPage.Shapes.Placeholders.Item(2).TextFrame.TextRange.Text=$notes
 $deck.SaveAs($output,24)
 $slide.Export((Join-Path $root 'FYP_Poster_Research_Preview.png'),'PNG',1683,2384)
 $slide.Export((Join-Path $root 'FYP_Poster_Research_Large.png'),'PNG',3366,4768)
 $fit=@()
 foreach($s in $slide.Shapes){if($s.HasTextFrame -and $s.TextFrame.HasText){$fit += [pscustomobject]@{Name=$s.Name;Width=$s.Width;Height=$s.Height;BoundWidth=$s.TextFrame.TextRange.BoundWidth;BoundHeight=$s.TextFrame.TextRange.BoundHeight}}}
 $fit|ConvertTo-Json -Depth 3|Set-Content -Encoding UTF8 (Join-Path $PSScriptRoot 'text-fit.json')
 Write-Output ('Saved '+$output+'; shapes='+$slide.Shapes.Count)
 $deck.Close()
 $deck=$app.Presentations.Open($output,$true,$false,$false)
 if($deck.Slides.Count -ne 1){throw 'Unexpected slide count after reopening'}
 $deck.Slides.Item(1).Export((Join-Path $root 'FYP_Poster_Research_Preview.png'),'PNG',1683,2384)
 Write-Output 'Reopened and rendered final PPTX successfully.'
}finally{if($deck){$deck.Close()};if($app){$app.Quit()}}
