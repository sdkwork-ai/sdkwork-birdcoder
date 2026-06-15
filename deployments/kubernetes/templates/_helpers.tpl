{{- define "sdkwork-birdcoder.fullname" -}}
{{- printf "%s-%s" .Release.Name "app" | trunc 63 | trimSuffix "-" -}}
{{- end -}}
