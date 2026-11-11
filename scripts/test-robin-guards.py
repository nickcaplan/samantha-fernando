"""Offline Robin safety checks. Never invokes a model or uses credentials."""
import copy, io, json, os, pathlib, re, tempfile, unittest, urllib.request
from unittest.mock import patch
WORKFLOW=pathlib.Path('.github/workflows/robin-advisory.yml').read_text()
REPO='nickcaplan/samantha-fernando'
SCRIPT=WORKFLOW.split("          python3 - <<'PY'\n",1)[1].split("\n          PY",1)[0]
SCRIPT='\n'.join(line[10:] for line in SCRIPT.splitlines())
SHA='a'*40
PR={'state':'open','draft':False,'head':{'repo':{'full_name':REPO},'sha':SHA},'base':{'ref':'main','repo':{'full_name':REPO,'private':False}}}
class GuardTests(unittest.TestCase):
    def guard(self, pr=None, number='1', diff='public diff'):
        with tempfile.TemporaryDirectory() as directory:
            out=pathlib.Path(directory,'output')
            responses=[json.dumps(PR if pr is None else pr).encode(),diff.encode()]
            def request(req, timeout):
                self.assertTrue(req.full_url.startswith('https://api.github.com/repos/'+REPO+'/pulls/'))
                return io.BytesIO(responses.pop(0))
            with patch.dict(os.environ,{'PR_NUMBER':number,'GH_TOKEN':'fake-test-value','GITHUB_OUTPUT':str(out)}),patch.object(urllib.request,'urlopen',side_effect=request):
                exec(compile(SCRIPT,'guard','exec'),{})
            self.assertEqual(out.read_text(),'head='+SHA+'\n')
    def test_valid_public_pr(self): self.guard()
    def test_invalid_number(self):
        for number in ['0','-1','1; echo test','1\n','../2']:
            with self.subTest(number=number),self.assertRaises(SystemExit): self.guard(number=number)
    def test_reject_closed_draft_fork_private_other_base_missing_repo_bad_sha(self):
        for change in ['closed','draft','fork','private','base','missing','sha','base_repo']:
            pr=copy.deepcopy(PR)
            if change=='closed':pr['state']='closed'
            if change=='draft':pr['draft']=True
            if change=='fork':pr['head']['repo']['full_name']='other/fork'
            if change=='private':pr['base']['repo']['private']=True
            if change=='base':pr['base']['ref']='other'
            if change=='missing':pr['head']['repo']=None
            if change=='sha':pr['head']['sha']='main'
            if change=='base_repo':pr['base']['repo']['full_name']='other/base'
            with self.subTest(change=change),self.assertRaises(SystemExit):self.guard(pr=pr)
    def test_diff_cap(self):
        for diff in ['','   ','x'*20001]:
            with self.subTest(length=len(diff)),self.assertRaises(SystemExit):self.guard(diff=diff)
        self.guard(diff='x'*20000)
    def test_owner_comment_only_no_checkout_or_auto_reviews(self):
        self.assertIn("github.actor == 'nickcaplan'",WORKFLOW)
        self.assertIn("github.triggering_actor == 'nickcaplan'",WORKFLOW)
        self.assertIn("github.repository == '"+REPO+"'",WORKFLOW)
        self.assertIn("github.event.comment.body == '/review'",WORKFLOW)
        self.assertNotIn('actions/checkout',WORKFLOW)
        self.assertNotIn('pull_request:',WORKFLOW.split('permissions:',1)[0])
        self.assertNotIn('workflow_dispatch:',WORKFLOW)
        self.assertIn('permissions: {}',WORKFLOW)
        self.assertIn('timeout-minutes: 5',WORKFLOW)
    def test_pinned_free_advisory_configuration(self):
        for value in ['antongulin/robin@808e18045c93f80f917a41be8fa3f80fa03d70a0','model: nvidia/nemotron-3-ultra-550b-a55b:free',"reasoning-effort: 'none'","agent-mode: 'off'","request-changes: 'false'","fail-on-high: 'false'","max-output-tokens: '4000'","max-diff-size: '20000'",'secrets.OPENROUTER_ROBIN_PILOT','EXPECTED_HEAD: ${{ steps.target.outputs.head }}']:
            self.assertIn(value,WORKFLOW)
        self.assertNotIn('openrouter/free',WORKFLOW)
if __name__=='__main__':unittest.main()
