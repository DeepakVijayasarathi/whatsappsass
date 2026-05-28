pipeline {
    agent any

    environment {
        IMAGE_NAME     = "whatsappsass"
        CONTAINER_NAME = "whatsappsass-container"

        FRONTEND_PORT  = "3000"
        BACKEND_PORT   = "4000"

        REPO_URL  = "https://github.com/DeepakVijayasarathi/whatsappsass.git"
        BRANCH    = "main"

        DATABASE_URL  = "postgresql://admin:Password2026@204.168.165.148:5432/whatsappsaa"
        JWT_SECRET    = "changeme-use-a-long-random-secret-in-production"
        NODE_ENV      = "production"
        FRONTEND_URL  = "http://103.118.158.189:3000"
        BACKEND_URL   = "http://127.0.0.1:4000"

    }

    stages {

        stage('Clean Workspace') {
            steps { deleteDir() }
        }

        stage('Clone Repository') {
            steps {
                git branch: "${BRANCH}",
                    url: "${REPO_URL}",
                    credentialsId: '2bbd378b-d531-4fc9-bf74-4441dbe63805'
            }
        }

        stage('Verify Structure') {
            steps {
                sh '''
                ls -la
                ls -la apps
                ls -la packages || true
                '''
            }
        }

        stage('Build Docker Image') {
            steps {
                sh 'docker build --no-cache -t $IMAGE_NAME .'
            }
        }

        stage('Stop Old Container') {
            steps {
                sh '''
                docker stop $CONTAINER_NAME || true
                docker rm   $CONTAINER_NAME || true
                '''
            }
        }

        stage('Run Container') {
            steps {
                withCredentials([
                    string(credentialsId: 'ENCRYPTION_KEY', variable: 'ENCRYPTION_KEY')
                ]) {
                    sh '''
                    docker run -d \
                      --name $CONTAINER_NAME \
                      --restart=always \
                      -p $FRONTEND_PORT:$FRONTEND_PORT \
                      -p $BACKEND_PORT:$BACKEND_PORT \
                      -e FRONTEND_PORT=$FRONTEND_PORT \
                      -e BACKEND_PORT=$BACKEND_PORT \
                      -e BACKEND_URL=$BACKEND_URL \
                      -e FRONTEND_URL=$FRONTEND_URL \
                      -e DATABASE_URL="$DATABASE_URL" \
                      -e JWT_SECRET="$JWT_SECRET" \
                      -e NODE_ENV=$NODE_ENV \
                      -e ENCRYPTION_KEY="$ENCRYPTION_KEY" \
                      $IMAGE_NAME
                    '''
                }
            }
        }

        stage('Health Check') {
            steps {
                sh '''
                sleep 20
                echo "=== CONTAINERS ==="
                docker ps

                echo "=== LOGS ==="
                docker logs $CONTAINER_NAME --tail 100

                echo "=== HEALTH ==="
                curl -sf http://localhost:4000/health && echo "Backend OK" || echo "Backend not yet ready"
                '''
            }
        }

        stage('Cleanup') {
            steps {
                sh 'docker system prune -f'
            }
        }
    }

    post {
        success { echo "✅ WhatsApp SaaS deployed successfully" }
        failure { echo "❌ Deployment failed - check logs" }
        always {
            sh '''
            echo "=== FINAL STATUS ==="
            docker ps -a | head -20
            '''
        }
    }
}
