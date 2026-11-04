$ErrorActionPreference = 'Stop'
$root = (Resolve-Path (Join-Path $PSScriptRoot '..\editable')).Path
$source = 'C:\Users\USER\Downloads\FYP_Poster.pptx'
$output = Join-Path $root 'FYP_Poster_Editable.pptx'

function Color([string]$hex) {
  $hex = $hex.TrimStart('#')
  return [int]([Convert]::ToInt32($hex.Substring(0,2),16) + 256*[Convert]::ToInt32($hex.Substring(2,2),16) + 65536*[Convert]::ToInt32($hex.Substring(4,2),16))
}
$navy = Color '103B45'
$teal = Color '087F83'
$purple = Color '7B40C3'
$indigo = Color '4B53B8'
$muted = Color '516572'
$red = Color 'E7253B'
$line = Color 'D5E6E7'
$white = Color 'FFFFFF'

function Box($name, [double]$x,[double]$y,[double]$w,[double]$h,[int]$fill,[double]$transparency=0) {
  $s = $slide.Shapes.AddShape(1,$x,$y,$w,$h)
  $s.Name = $name
  $s.Fill.ForeColor.RGB = $fill
  $s.Fill.Transparency = $transparency
  $s.Line.Visible = 0
  return $s
}
function Text($name,[string]$value,[double]$x,[double]$y,[double]$w,[double]$h,[double]$size,[int]$color,[bool]$bold=$false) {
  $s=$slide.Shapes.AddTextbox(1,$x,$y,$w,$h)
  $s.Name=$name
  $s.TextFrame.MarginLeft=0
  $s.TextFrame.MarginRight=0
  $s.TextFrame.MarginTop=0
  $s.TextFrame.MarginBottom=0
  $s.TextFrame.WordWrap=-1
  $s.TextFrame.AutoSize=0
  $s.TextFrame.TextRange.Text=$value
  $s.TextFrame.TextRange.Font.Name='Arial'
  $s.TextFrame.TextRange.Font.Size=$size
  $s.TextFrame.TextRange.Font.Color.RGB=$color
  $s.TextFrame.TextRange.Font.Bold=if($bold){-1}else{0}
  $s.TextFrame.TextRange.ParagraphFormat.SpaceAfter=8
  $s.TextFrame.TextRange.ParagraphFormat.SpaceBefore=0
  $s.TextFrame2.AutoSize=0
  $s.Height=$h
  return $s
}
function Rule($name,[double]$x,[double]$y,[double]$w,[int]$color,[double]$thickness=2) {
  $s=$slide.Shapes.AddLine($x,$y,$x+$w,$y)
  $s.Name=$name
  $s.Line.ForeColor.RGB=$color
  $s.Line.Weight=$thickness
  return $s
}
function Picture($name,$file,[double]$x,[double]$y,[double]$w) {
  Add-Type -AssemblyName System.Drawing
  $image=[System.Drawing.Image]::FromFile((Join-Path $root $file))
  $height=$w*$image.Height/$image.Width
  $image.Dispose()
  $s=$slide.Shapes.AddPicture((Join-Path $root $file),0,-1,$x,$y,$w,$height)
  $s.Name=$name
  return $s
}
function Feature($name,$title,$body,$x,$y,$w,$accent) {
  $null=Text ($name+' title') $title $x $y $w 37 27 $accent $true
  $null=Text ($name+' body') $body $x ($y+43) $w 83 26 $muted
}

$app=$null
$deck=$null
try {
  $app=New-Object -ComObject PowerPoint.Application
  $deck=$app.Presentations.Open($source,$false,$false,$false)
  $slide=$deck.Slides.Item(1)
  # Reuse the original file, physical page dimensions, masters and native university marks.
  for($i=$slide.Shapes.Count;$i -ge 1;$i--) {
    $s=$slide.Shapes.Item($i)
    if($s.Name -notin @('Group 4','Group 6')){$s.Delete()}
  }
  while($deck.Slides.Count -gt 1){$deck.Slides.Item($deck.Slides.Count).Delete()}
  $slide.FollowMasterBackground=0
  $slide.Background.Fill.Solid()
  $slide.Background.Fill.ForeColor.RGB=$white
  $bg=$slide.Shapes.AddPicture((Join-Path $root 'assets\medical-background.png'),0,-1,0,0,$deck.PageSetup.SlideWidth,$deck.PageSetup.SlideHeight)
  $bg.Name='Generated medical background'
  $bg.ZOrder(1)
  $logo=$slide.Shapes.Item('Group 6')
  $logo.LockAspectRatio=-1
  $logo.Width=113
  $logo.Left=70
  $logo.Top=64
  $crest=$slide.Shapes.Item('Group 4')
  $crest.LockAspectRatio=-1
  $crest.Width=105
  $crest.Left=1505
  $crest.Top=65
  $null=Box 'Background readability veil' 0 400 1683 1984 $white 0.22

  $null=Text 'FYP label' 'FINAL YEAR PROJECT  |  WEB PLATFORM' 235 63 1090 32 23 $teal $true
  $null=Text 'Project title' 'Smart Diabetes Digital Twin' 230 112 1240 90 66 $navy $true
  $null=Text 'Project subtitle' 'Personalised Health Management Platform' 234 204 1220 72 46 $navy $true
  $null=Text 'Institution' 'Swinburne University of Technology Sarawak Campus' 235 287 1200 47 30 $muted
  $null=Text 'Supervisor' 'Supervisor: Ts. Dr. Vong Wan Tze' 235 333 1100 36 25 $muted
  $null=Rule 'Swinburne red accent' 70 393 1543 $red 4

  $null=Text 'Overview heading' 'One platform. Three connected workspaces.' 70 429 1510 55 39 $navy $true
  $null=Text 'Overview body' 'Bring diabetes records, glucose monitoring and model forecasts into one website. Patients review their health, doctors follow assigned records, and administrators manage access and model operations.' 70 497 1505 111 30 $muted

  $null=Text 'Patient heading' '01  Patient workspace' 70 646 740 55 36 $purple $true
  $null=Text 'Patient lead' 'Understand recorded health and explore glucose forecasts.' 70 705 735 77 28 $muted
  $null=Rule 'Patient section rule' 70 792 741 $purple 3
  $null=Text 'Doctor heading' '02  Doctor workspace' 870 646 741 55 36 $teal $true
  $null=Text 'Doctor lead' 'Review the cohort and open records that need attention.' 870 705 735 77 28 $muted
  $null=Rule 'Doctor section rule' 870 792 741 $teal 3

  $null=Box 'Patient screenshot frame' 67 816 747 566 $white
  $null=Box 'Doctor screenshot frame' 867 816 747 566 $white
  $patientPic=Picture 'Current patient home screenshot' 'assets\patient-workspace.png' 70 819 741
  $doctorPic=Picture 'Current doctor overview screenshot' 'assets\doctor-workspace.png' 870 819 741
  $null=Text 'Patient screen caption' 'Health overview: recorded trends and glucose range.' 70 1393 741 32 22 $muted
  $null=Text 'Doctor screen caption' 'Care overview: review filters and patient drill-down.' 870 1393 741 32 22 $muted

  $null=Text 'Patient feature list' "Health dashboard, profile and glucose monitoring.`rMy digital twin: 6 h / 12 h GRU forecasts and what-if comparisons.`rSave predictions to Lab results; review reports and settings." 70 1448 741 166 27 $navy
  $null=Text 'Doctor feature list' "Search and filter assigned patient records.`rReview glucose records, missing results and reports.`rOpen the patient's workspace for detailed review." 870 1448 741 166 27 $navy

  $null=Rule 'Administrator divider' 70 1651 1543 $line 2
  $null=Text 'Administrator heading' '03  Administrator workspace' 70 1684 1510 55 36 $indigo $true
  $adminPic=Picture 'Current administrator overview screenshot' 'assets\admin-workspace.png' 70 1760 670
  Feature 'Account administration' 'Accounts and care-team access' 'Review Doctor applications, manage users, and assign patients to approved doctors.' 820 1760 785 $indigo
  Feature 'Audit and retraining' 'Activity history and model retraining' 'Track platform changes and retrain the GRU using the latest Supabase CGM records.' 820 1904 785 $indigo

  $null=Text 'Workflow heading' 'Patient review workflow' 820 2055 790 42 29 $navy $true
  $steps=@(
    @{x=820;y=2110;t='1  Sign in';d='Authorized records'},
    @{x=1222;y=2110;t='2  Review';d='Glucose history'},
    @{x=820;y=2197;t='3  Explore';d='Patient digital twin'},
    @{x=1222;y=2197;t='4  Save';d='Results and reports'}
  )
  foreach($step in $steps){
    $null=Box ('Workflow step '+$step.t) $step.x $step.y 375 75 (Color 'EDF6F5')
    $null=Text ('Workflow title '+$step.t) $step.t ($step.x+14) ($step.y+8) 348 28 24 $teal $true
    $null=Text ('Workflow detail '+$step.t) $step.d ($step.x+14) ($step.y+40) 348 26 21 $muted
  }
  # Native connectors remain individually editable.
  foreach($pair in @(@(1198,2147,1216,2147),@(1198,2234,1216,2234))){
    $conn=$slide.Shapes.AddLine($pair[0],$pair[1],$pair[2],$pair[3])
    $conn.Line.ForeColor.RGB=$teal
    $conn.Line.Weight=2
    $conn.Line.EndArrowheadStyle=3
  }
  $null=Text 'Screenshot data disclosure' 'Website screenshots use synthetic test records.' 70 2272 726 30 20 $muted
  $null=Rule 'Footer rule' 70 2314 1543 $teal 2
  $null=Text 'Architecture footer' 'React + TypeScript  |  Flask API  |  Supabase  |  GRU forecasting  |  Neo4j  |  github.com/AA-4499/FYP-A-Sep-2026' 70 2336 1543 30 20 $navy
  # Keep the source and limitations in editable speaker notes rather than cluttering the poster.
  $notes="Source: https://github.com/AA-4499/FYP-A-Sep-2026 ; TrainingModel commit 841319a.`rBased on user-supplied FYP_Poster.pptx. Original slide dimensions and university marks retained. Empty second slide removed. All headings, descriptions and workflow elements are editable native PowerPoint objects; screenshots and generated background are embedded images.`rDoctor-side Digital twin menu and route have been removed. My digital twin remains in the patient workspace. Lab results contain saved model predictions, not measured laboratory tests. Model outputs and what-if scenarios are exploratory and are not clinically validated treatment recommendations. The knowledge-graph recommendation interface remains a prototype. Successful online retraining updates online predictions; repository/browser models are fixed snapshots.`rScreenshots were captured from the current local website with synthetic test records; their displayed numbers are not research evaluation results. No student name, email, clinical accuracy or patient-outcome claim was supplied or invented.`rNext work: held-out patient forecasting evaluation, scenario validation and clinician-reviewed recommendation delivery.`rGenerated background: built-in ImageGen; prompt saved alongside source assets."
  $slide.NotesPage.Shapes.Placeholders.Item(2).TextFrame.TextRange.Text=$notes
  $deck.SaveAs($output,24)
  $slide.Export((Join-Path $root 'FYP_Poster_Preview.png'),'PNG',1683,2384)
  $slide.Export((Join-Path $root 'FYP_Poster_Print_Preview.png'),'PNG',3366,4768)
  $measurements=@()
  foreach($s in $slide.Shapes){
    if($s.HasTextFrame -and $s.TextFrame.HasText){
      $measurements += [pscustomobject]@{Name=$s.Name;Left=$s.Left;Top=$s.Top;Width=$s.Width;Height=$s.Height;BoundWidth=$s.TextFrame.TextRange.BoundWidth;BoundHeight=$s.TextFrame.TextRange.BoundHeight;Text=$s.TextFrame.TextRange.Text}
    }
  }
  $measurements | ConvertTo-Json -Depth 4 | Set-Content -Encoding UTF8 (Join-Path $PSScriptRoot 'text-fit.json')
  Write-Output ('Saved '+$output+'; slides: '+$deck.Slides.Count+'; native shapes: '+$slide.Shapes.Count)
} finally {
  if($deck){$deck.Close()}
  if($app){$app.Quit()}
}
