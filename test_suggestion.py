import urllib.request
import json
import uuid

req1 = urllib.request.Request("http://127.0.0.1:8000/api/start-call", data=json.dumps({"customer_name": "Test"}).encode(), headers={"Content-Type": "application/json"})
call_id = json.loads(urllib.request.urlopen(req1).read())["call_id"]
print("Call ID:", call_id)

req2 = urllib.request.Request("http://127.0.0.1:8000/api/get-suggestion", data=json.dumps({"call_id": call_id, "transcript": "I object to this price."}).encode(), headers={"Content-Type": "application/json"})
try:
    res2 = urllib.request.urlopen(req2)
    print(res2.read())
except Exception as e:
    print("ERROR:", e)
    if hasattr(e, 'read'):
        print(e.read())
